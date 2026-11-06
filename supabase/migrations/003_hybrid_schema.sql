-- =====================================================================
--  003: move the store to the Hybrid design
--  Source: Clothing Store DB vault -> Hybrid/Hybrid Data Map.md
--          (_sql files/01_tables.sql, 02_functions.sql, 03_security.sql)
--
--  Duskeo changes to the vault design:
--    * brands starts at id 0 and holds one row: Duskeo (id 0). products.brand_id defaults to 0.
--    * user_devices is created but left empty (website only, no app push tokens yet).
--    * wallet_transactions is created but left empty (store credit is not used yet).
--    * Sample data from seed.sql is NOT loaded; only Duskeo's own catalog data.
--
--  Carried over from 001/002: auth users, profiles, admins (admin_users -> staff role admin),
--  restock_requests, products + stock, the product-images bucket and its policies.
--  The old dashboard-made orders/order_items move to schema "legacy" unchanged.
--  Run once, on a database that has 001 and 002 applied.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Keep the old rows, then retire the old shape
-- ---------------------------------------------------------------------
create temp table old_products  as select * from public.products;
create temp table old_inventory as select * from public.inventory;
create temp table old_admins    as select * from public.admin_users;

-- The first checkout (orders, order_items, place_order(jsonb, jsonb)) was made in the dashboard, not in a
-- migration. Its rows are kept untouched in schema "legacy" (not exposed by the API); the design's tables replace it.
create schema if not exists legacy;
comment on schema legacy is 'Old tables kept for reference after migration 003. Not exposed by the Supabase API.';
do $$
begin
  if to_regclass('public.orders') is not null then
    drop trigger if exists orders_restore_cancelled_stock on public.orders;
    drop trigger if exists orders_set_updated_at on public.orders;
    alter table public.orders set schema legacy;
  end if;
  if to_regclass('public.order_items') is not null then
    alter table public.order_items drop constraint if exists order_items_product_id_fkey;  -- product_id values are kept
    alter table public.order_items set schema legacy;
  end if;
end $$;
drop function if exists public.restore_cancelled_order_stock();
drop function if exists public.place_order(jsonb, jsonb);

drop function if exists public.take_inventory(text, text);
drop table public.inventory;
drop table public.products;
drop table public.admin_users;          -- replaced by public.staff; is_admin() is redefined at the end

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_customer();

drop trigger if exists profiles_set_updated_at on public.profiles;
drop policy if exists "Customers can view their own profile" on public.profiles;
drop policy if exists "Customers can update their own profile" on public.profiles;
drop function if exists public.set_updated_at();   -- replaced by private.set_updated_at()


-- =====================================================================
--  CLOTHING STORE (Myntra-style) — PostgreSQL / Supabase schema
--  Part 1 of 3: types, tables, comments, indexes
--  Run order: 01_tables.sql -> 02_functions.sql -> 03_security.sql -> seed.sql (optional)
--  Money is always INTEGER PAISE (₹499.00 = 49900). Never float.
-- =====================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create schema if not exists private;          -- helper functions, NOT exposed by the Supabase API
comment on schema private is 'Internal helper functions. Supabase only exposes the public schema, so nothing here can be called from the app directly.';

-- ---------------------------------------------------------------------
-- ENUMS (fixed lists of allowed values; 4 bytes each, self-documenting)
-- ---------------------------------------------------------------------
create type public.gender_t          as enum ('men','women','boys','girls','unisex');
create type public.product_status_t  as enum ('draft','active','archived');
create type public.size_system_t     as enum ('alpha','waist','numeric','kids_age','free');
create type public.address_type_t    as enum ('home','work','other');
create type public.order_type_t      as enum ('regular','exchange');
create type public.order_status_t    as enum ('pending_payment','placed','completed','cancelled');
create type public.item_status_t     as enum ('pending_payment','placed','packed','shipped','out_for_delivery','delivered','cancelled','return_requested','returned','exchanged','rto');
create type public.payment_method_t  as enum ('upi','card','netbanking','wallet','cod','store_credit');
create type public.payment_status_t  as enum ('created','authorized','captured','failed','refunded','partially_refunded');
create type public.shipment_status_t as enum ('created','picked_up','in_transit','out_for_delivery','delivered','rto_initiated','rto_delivered','lost');
create type public.return_type_t     as enum ('return','exchange');
create type public.return_reason_t   as enum ('size_too_small','size_too_large','damaged','wrong_item','quality_issue','not_as_described','changed_mind');
create type public.return_status_t   as enum ('requested','approved','rejected','pickup_scheduled','picked_up','received','qc_failed','refunded','exchanged','cancelled');
create type public.refund_method_t   as enum ('original_payment','store_credit','bank_transfer');
create type public.refund_status_t   as enum ('pending','processed','failed');
create type public.discount_type_t   as enum ('percent','flat');
create type public.stock_reason_t    as enum ('purchase','sale','return_restock','rto_restock','adjustment','damage','transfer_in','transfer_out');
create type public.wallet_reason_t   as enum ('refund','cashback','order_payment','order_cancel_reversal','admin_adjust','expiry');
create type public.fit_feedback_t    as enum ('runs_small','true_to_size','runs_large');
create type public.review_status_t   as enum ('pending','published','rejected');
create type public.banner_link_t     as enum ('category','brand','product','collection','search','url');
create type public.staff_role_t      as enum ('admin','catalog','warehouse','support');
create type public.device_platform_t as enum ('android','ios','web');

-- =====================================================================
-- STORE CONFIG
-- =====================================================================
create table public.store_settings (
  id                      boolean primary key default true check (id),
  free_shipping_min_paise integer  not null default 79900,
  shipping_fee_paise      integer  not null default 7900,
  cod_fee_paise           integer  not null default 0,
  platform_fee_paise      integer  not null default 0,
  payment_window_minutes  smallint not null default 15,
  return_window_days      smallint not null default 14,
  max_qty_per_item        smallint not null default 10,
  image_cdn_base_url      text     not null default 'https://img.example.com/',
  support_email           text,
  updated_at              timestamptz not null default now()
);
comment on table public.store_settings is 'Exactly ONE row of store-wide rules (fees, windows, limits). Change a value here and checkout uses it instantly — no app update needed.';
comment on column public.store_settings.id is 'Always TRUE. The primary key + check makes it impossible to insert a second row.';
comment on column public.store_settings.free_shipping_min_paise is 'Order value (after coupon) at or above which shipping is free. 79900 = ₹799.';
comment on column public.store_settings.shipping_fee_paise is 'Shipping charged when the order is below the free-shipping value.';
comment on column public.store_settings.cod_fee_paise is 'Extra fee for Cash on Delivery orders (0 = none).';
comment on column public.store_settings.platform_fee_paise is 'Flat platform/convenience fee added to every order (0 = none).';
comment on column public.store_settings.payment_window_minutes is 'Minutes a prepaid order waits for payment before it is cancelled and its stock released.';
comment on column public.store_settings.return_window_days is 'Days after delivery during which a return/exchange can be requested.';
comment on column public.store_settings.max_qty_per_item is 'Maximum pieces of one size a customer can buy in one order.';
comment on column public.store_settings.image_cdn_base_url is 'Prefix added to every image key to build a full image URL (your Cloudflare R2 / CDN domain).';
comment on column public.store_settings.support_email is 'Shown in the app and in order emails.';
comment on column public.store_settings.updated_at is 'Last time a setting changed.';

create table public.tax_slabs (
  id                    smallint generated always as identity primary key,
  hsn_prefix            text,
  min_unit_price_paise  integer not null default 0,
  max_unit_price_paise  integer,
  rate                  numeric(4,2) not null check (rate >= 0),
  valid_from            date not null,
  valid_to              date
);
comment on table public.tax_slabs is 'GST rate rules for clothing. The rate is chosen by the per-piece SALE value. Seeded with the rules in force since 22 Sep 2025 (5% up to ₹2,500 per piece, 18% above). Confirm with your CA.';
comment on column public.tax_slabs.id is 'Row id.';
comment on column public.tax_slabs.hsn_prefix is 'Applies only to HSN codes starting with this (e.g. 61 knitted, 62 woven). NULL = all clothing.';
comment on column public.tax_slabs.min_unit_price_paise is 'Lowest per-piece sale value (inclusive) this rate applies to.';
comment on column public.tax_slabs.max_unit_price_paise is 'Highest per-piece sale value (inclusive). NULL = no upper limit.';
comment on column public.tax_slabs.rate is 'GST percentage, e.g. 5.00.';
comment on column public.tax_slabs.valid_from is 'Date the rule starts applying.';
comment on column public.tax_slabs.valid_to is 'Date the rule stops applying. NULL = still in force.';

-- =====================================================================
-- USERS
-- =====================================================================
-- (Duskeo) profiles already exists from 002: reshape it to the design instead of recreating it.
alter table public.profiles
  alter column full_name drop not null, alter column full_name drop default,
  alter column email drop not null, alter column email drop default,
  add column if not exists phone text,
  add column if not exists gender text check (gender in ('male','female','other')),
  add column if not exists date_of_birth date,
  add column if not exists avatar_key text,
  add column if not exists marketing_opt_in boolean not null default false;
update public.profiles set full_name = nullif(full_name, ''), email = nullif(email, '');
comment on table public.profiles is 'One row per customer, created automatically when someone signs up (Supabase Auth). Login details stay in auth.users; this table holds what the app shows and edits.';
comment on column public.profiles.id is 'Same UUID as the Supabase Auth user. Every user-owned table points here.';
comment on column public.profiles.full_name is 'Name shown on the profile screen.';
comment on column public.profiles.phone is 'Mobile number (copied from auth on sign-up if they used phone OTP).';
comment on column public.profiles.email is 'Email (copied from auth on sign-up).';
comment on column public.profiles.gender is 'Optional; used to pick a default Men/Women home feed.';
comment on column public.profiles.date_of_birth is 'Optional; birthday offers.';
comment on column public.profiles.avatar_key is 'Storage key of the profile photo (e.g. avatars/<uuid>.webp).';
comment on column public.profiles.marketing_opt_in is 'TRUE only if the user agreed to promotional messages.';
comment on column public.profiles.created_at is 'Sign-up time.';
comment on column public.profiles.updated_at is 'Last profile edit (set automatically).';

create table public.staff (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  role       public.staff_role_t not null,
  created_at timestamptz not null default now()
);
comment on table public.staff is 'Which users can use the admin side. No row = normal customer. Security rules check this table.';
comment on column public.staff.user_id is 'The staff member''s profile.';
comment on column public.staff.role is 'admin = everything; catalog = products/prices; warehouse = stock & shipping; support = orders, returns, refunds.';
comment on column public.staff.created_at is 'When access was granted.';

create table public.addresses (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  phone        text not null check (phone ~ '^[6-9][0-9]{9}$'),
  line1        text not null,
  line2        text,
  landmark     text,
  city         text not null,
  state        text not null,
  pincode      char(6) not null check (pincode ~ '^[1-9][0-9]{5}$'),
  address_type public.address_type_t not null default 'home',
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.addresses is 'Saved delivery addresses. Orders COPY the address at checkout, so editing or deleting an address never changes past orders.';
comment on column public.addresses.id is 'Address id (passed to place_order).';
comment on column public.addresses.user_id is 'Owner.';
comment on column public.addresses.name is 'Receiver name.';
comment on column public.addresses.phone is '10-digit Indian mobile, no +91.';
comment on column public.addresses.line1 is 'House / flat / building.';
comment on column public.addresses.line2 is 'Street / area / locality.';
comment on column public.addresses.landmark is 'Optional landmark for the courier.';
comment on column public.addresses.city is 'City / town.';
comment on column public.addresses.state is 'State (needed for GST invoice place-of-supply).';
comment on column public.addresses.pincode is '6-digit PIN, checked against serviceable_pincodes at checkout.';
comment on column public.addresses.address_type is 'home / work / other (work = weekday delivery hint).';
comment on column public.addresses.is_default is 'Pre-selected at checkout. Only one per user (unique index).';
comment on column public.addresses.created_at is 'Saved at.';
comment on column public.addresses.updated_at is 'Last edit.';
create unique index addresses_one_default_per_user on public.addresses (user_id) where is_default;
create index addresses_user_idx on public.addresses (user_id);

create table public.user_devices (
  fcm_token    text primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  platform     public.device_platform_t not null,
  app_version  text,
  last_seen_at timestamptz not null default now()
);
comment on table public.user_devices is 'Push-notification tokens (Firebase Cloud Messaging is free) for each phone/browser a user is logged in on.';
comment on column public.user_devices.fcm_token is 'Token from firebase_messaging in Flutter. Primary key because one token = one device install.';
comment on column public.user_devices.user_id is 'Who is logged in on this device.';
comment on column public.user_devices.platform is 'android / ios / web.';
comment on column public.user_devices.app_version is 'App version, handy for forcing updates.';
comment on column public.user_devices.last_seen_at is 'Last app open; delete tokens older than ~60 days.';
create index user_devices_user_idx on public.user_devices (user_id);

-- =====================================================================
-- CATALOG
-- =====================================================================
create table public.brands (
  id          integer generated always as identity (start with 0 minvalue 0) primary key,
  name        text not null,
  slug        text not null unique,
  logo_key    text,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
comment on table public.brands is 'Clothing brands you sell (one row if it is only your own brand).';
comment on column public.brands.id is 'Brand id.';
comment on column public.brands.name is 'Display name, e.g. "Roadster".';
comment on column public.brands.slug is 'URL-safe name, e.g. "roadster" (used in web links /brand/roadster).';
comment on column public.brands.logo_key is 'Storage key of the logo image.';
comment on column public.brands.description is 'Short brand story for the brand page.';
comment on column public.brands.is_active is 'FALSE hides the brand and its products from shoppers.';
comment on column public.brands.created_at is 'Added at.';

create table public.size_charts (
  id             integer generated always as identity primary key,
  name           text not null,
  brand_id       integer references public.brands(id),
  unit           text not null default 'in' check (unit in ('in','cm')),
  measurements   jsonb not null,
  how_to_measure text,
  created_at     timestamptz not null default now()
);
comment on table public.size_charts is 'Size guide tables shown on the product page. Stored as JSON because every garment type has different measurements (chest for shirts, waist/inseam for jeans).';
comment on column public.size_charts.id is 'Size chart id.';
comment on column public.size_charts.name is 'Internal name, e.g. "Roadster Men T-Shirts".';
comment on column public.size_charts.brand_id is 'Brand this chart belongs to (NULL = generic).';
comment on column public.size_charts.unit is 'in or cm (app can convert).';
comment on column public.size_charts.measurements is 'JSON like {"columns":["Chest","Length"],"rows":{"S":[38,27],"M":[40,28]}}.';
comment on column public.size_charts.how_to_measure is 'Text tips shown under the chart.';
comment on column public.size_charts.created_at is 'Added at.';

create table public.categories (
  id            integer generated always as identity primary key,
  parent_id     integer references public.categories(id) on delete restrict,
  name          text not null,
  slug          text not null unique,
  gender        public.gender_t,
  level         smallint not null default 0,
  path_ids      integer[] not null default '{}',
  image_key     text,
  size_chart_id integer references public.size_charts(id),
  sort_order    smallint not null default 0,
  is_active     boolean not null default true
);
comment on table public.categories is 'Category tree, e.g. Men > Topwear > T-Shirts. Products attach to the deepest level. path_ids lets one query fetch everything under "Topwear".';
comment on column public.categories.id is 'Category id.';
comment on column public.categories.parent_id is 'Parent category; NULL for top level (Men, Women, Kids).';
comment on column public.categories.name is 'Display name, e.g. "T-Shirts".';
comment on column public.categories.slug is 'Unique URL name, e.g. "men-tshirts".';
comment on column public.categories.gender is 'Who it is for (men/women/boys/girls/unisex).';
comment on column public.categories.level is '0 = top (Men), 1 = group (Topwear), 2 = leaf (T-Shirts). Set automatically.';
comment on column public.categories.path_ids is 'Ids from the root down to this category, e.g. {1,4,9}. Set automatically by a trigger.';
comment on column public.categories.image_key is 'Image for the category tile on the home/menu screen.';
comment on column public.categories.size_chart_id is 'Default size chart for products in this category.';
comment on column public.categories.sort_order is 'Order in menus (lower first).';
comment on column public.categories.is_active is 'FALSE hides it from menus.';
create index categories_parent_idx on public.categories (parent_id);
create index categories_path_gin on public.categories using gin (path_ids);

create table public.colors (
  id     smallint generated always as identity primary key,
  name   text not null unique,
  family text not null,
  hex    char(7) not null check (hex ~ '^#[0-9A-Fa-f]{6}$')
);
comment on table public.colors is 'Color names. The "family" groups shades for the filter (Navy, Teal and Sky Blue all filter as "Blue").';
comment on column public.colors.id is 'Color id.';
comment on column public.colors.name is 'Exact shade shown on the product, e.g. "Navy Blue".';
comment on column public.colors.family is 'Filter group, e.g. "Blue".';
comment on column public.colors.hex is 'Swatch color for the filter chip, e.g. #1F2A44.';

create table public.sizes (
  id         smallint generated always as identity primary key,
  label      text not null,
  system     public.size_system_t not null,
  sort_order smallint not null,
  unique (system, label)
);
comment on table public.sizes is 'Every size label you use, with a sort order so S comes before M before L (alphabetical would be wrong).';
comment on column public.sizes.id is 'Size id.';
comment on column public.sizes.label is 'Shown to the user: XS, S, M, 32, 4-5Y, Free Size.';
comment on column public.sizes.system is 'alpha (S/M/L), waist (28/30/32), numeric (UK 8/10), kids_age (2-3Y), free.';
comment on column public.sizes.sort_order is 'Display order within the system.';

create table public.attribute_definitions (
  id             integer generated always as identity primary key,
  key            text not null check (key ~ '^[a-z_]+$'),
  label          text not null,
  category_id    integer references public.categories(id),
  allowed_values text[],
  is_filterable  boolean not null default true,
  sort_order     smallint not null default 0,
  unique nulls not distinct (key, category_id)
);
comment on table public.attribute_definitions is 'Describes the JSON attributes products can have (fabric, fit, sleeve, neck...). Drives the filter panel in the app and keeps values consistent.';
comment on column public.attribute_definitions.id is 'Row id.';
comment on column public.attribute_definitions.key is 'JSON key in products.attributes, e.g. "fabric".';
comment on column public.attribute_definitions.label is 'Shown in the filter panel, e.g. "Fabric".';
comment on column public.attribute_definitions.category_id is 'Only for this category and below; NULL = all clothing.';
comment on column public.attribute_definitions.allowed_values is 'Allowed values, e.g. {Cotton,Linen,Polyester}. NULL = free text.';
comment on column public.attribute_definitions.is_filterable is 'TRUE = show as a filter with counts.';
comment on column public.attribute_definitions.sort_order is 'Order in the filter panel.';

create table public.products (
  id                 bigint generated always as identity primary key,
  style_code         text not null,
  brand_id           integer  not null default 0 references public.brands(id),
  category_id        integer  not null references public.categories(id),
  color_id           smallint not null references public.colors(id),
  gender             public.gender_t not null,
  title              text not null,
  slug               text not null unique,
  description        text,
  attributes         jsonb not null default '{}'::jsonb,
  images             text[] not null default '{}',
  care_instructions  text,
  country_of_origin  text not null default 'India',
  hsn_code           text,
  mrp_paise          integer not null check (mrp_paise > 0),
  price_paise        integer not null check (price_paise > 0),
  discount_pct       smallint generated always as (round(100 - price_paise * 100.0 / mrp_paise)::smallint) stored,
  size_chart_id      integer references public.size_charts(id),
  available_size_ids smallint[] not null default '{}',
  in_stock           boolean not null default false,
  rating_avg         numeric(2,1) not null default 0,
  rating_count       integer not null default 0,
  popularity         integer not null default 0,
  tags               text[] not null default '{}',
  status             public.product_status_t not null default 'draft',
  search_vector      tsvector,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint price_not_above_mrp check (price_paise <= mrp_paise)
);
comment on table public.products is 'One product page = one style in ONE color (exactly how Myntra lists them: each color is its own card). Sizes live in product_variants. Listing data (stock, sizes, rating) is pre-computed here so a listing page is a single fast query.';
comment on column public.products.id is 'Product id.';
comment on column public.products.style_code is 'Same for all colors of one design. Used for the "More Colors" strip on the product page.';
comment on column public.products.brand_id is 'Brand.';
comment on column public.products.category_id is 'Leaf category, e.g. T-Shirts.';
comment on column public.products.color_id is 'The color of this listing.';
comment on column public.products.gender is 'men / women / boys / girls / unisex (unisex shows in both Men and Women).';
comment on column public.products.title is 'Card title, e.g. "Men Pure Cotton Slim Fit T-shirt".';
comment on column public.products.slug is 'Unique URL name for web links and sharing.';
comment on column public.products.description is 'Product details paragraph.';
comment on column public.products.attributes is 'Flexible specs as JSON: {"fabric":"Cotton","fit":"Slim Fit","sleeve":"Short Sleeves","neck":"Round Neck","pattern":"Solid","occasion":"Casual"}. Indexed for filters.';
comment on column public.products.images is 'Image keys in display order; the first one is the card image. Full URL = store_settings.image_cdn_base_url + key.';
comment on column public.products.care_instructions is 'Wash care text, e.g. "Machine wash cold".';
comment on column public.products.country_of_origin is 'Legally required on Indian e-commerce listings.';
comment on column public.products.hsn_code is 'GST product code (6109 = knitted T-shirts, 6205 = woven men''s shirts...). Printed on invoices.';
comment on column public.products.mrp_paise is 'MRP (shown struck through), in paise. 129900 = ₹1,299.';
comment on column public.products.price_paise is 'Selling price before coupons, in paise. Can never be above MRP.';
comment on column public.products.discount_pct is 'Calculated automatically: "54% OFF". Stored so you can sort/filter by discount.';
comment on column public.products.size_chart_id is 'Overrides the category''s size chart (NULL = use category''s).';
comment on column public.products.available_size_ids is 'Size ids currently in stock. Maintained by a trigger on inventory; powers the size filter and the "Sizes: S M L" line on cards.';
comment on column public.products.in_stock is 'TRUE when at least one size can be bought. Out-of-stock products sort last.';
comment on column public.products.rating_avg is 'Average star rating (e.g. 4.3), kept up to date by a trigger on reviews.';
comment on column public.products.rating_count is 'Number of published ratings.';
comment on column public.products.popularity is 'Score for the default "Popular" sort (units sold in the last 30 days). Refreshed by refresh_popularity().';
comment on column public.products.tags is 'Free tags for merchandising/search, e.g. {summer,festive,bestseller}.';
comment on column public.products.status is 'draft (hidden), active (live), archived (hidden but kept for old orders).';
comment on column public.products.search_vector is 'Full-text search data (title, brand, category, color, attributes). Built by a trigger — never edit by hand.';
comment on column public.products.published_at is 'First time it went live; used for "What''s New" sort.';
comment on column public.products.created_at is 'Created at.';
comment on column public.products.updated_at is 'Last edit (set automatically).';
create index products_cat_pop_idx    on public.products (category_id, popularity desc) where status = 'active';
create index products_cat_price_idx  on public.products (category_id, price_paise)     where status = 'active';
create index products_brand_idx      on public.products (brand_id)                     where status = 'active';
create index products_style_idx      on public.products (style_code);
create index products_attr_gin       on public.products using gin (attributes jsonb_path_ops) where status = 'active';
create index products_sizes_gin      on public.products using gin (available_size_ids)        where status = 'active';
create index products_search_gin     on public.products using gin (search_vector);
create index products_title_trgm     on public.products using gin (title extensions.gin_trgm_ops);

create table public.product_variants (
  id                   bigint generated always as identity primary key,
  product_id           bigint not null references public.products(id) on delete cascade,
  size_id              smallint not null references public.sizes(id),
  sku                  text not null unique,
  ean                  text unique,
  mrp_paise_override   integer check (mrp_paise_override > 0),
  price_paise_override integer check (price_paise_override > 0),
  weight_grams         smallint,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  unique (product_id, size_id)
);
comment on table public.product_variants is 'The buyable unit (SKU) = one product in one size. Cart, stock and orders all point to a variant.';
comment on column public.product_variants.id is 'Variant id (this is what goes into the cart).';
comment on column public.product_variants.product_id is 'The product (style + color).';
comment on column public.product_variants.size_id is 'The size.';
comment on column public.product_variants.sku is 'Your stock code, e.g. RDSTR-TS-1042-NVY-M. Printed on labels.';
comment on column public.product_variants.ean is 'Barcode number (optional).';
comment on column public.product_variants.mrp_paise_override is 'Only if this size has a different MRP (e.g. 3XL). NULL = use product MRP.';
comment on column public.product_variants.price_paise_override is 'Only if this size sells at a different price. NULL = use product price.';
comment on column public.product_variants.weight_grams is 'Packed weight; couriers charge by weight.';
comment on column public.product_variants.is_active is 'FALSE stops selling this size without deleting history.';
comment on column public.product_variants.created_at is 'Created at.';

-- =====================================================================
-- STOCK
-- =====================================================================
create table public.warehouses (
  id        integer generated always as identity primary key,
  code      text not null unique,
  name      text not null,
  address   text,
  city      text not null,
  state     text not null,
  pincode   char(6) not null,
  is_active boolean not null default true
);
comment on table public.warehouses is 'Places stock is kept and shipped from. Start with one; add more later without changing anything else.';
comment on column public.warehouses.id is 'Warehouse id.';
comment on column public.warehouses.code is 'Short code, e.g. BLR1 (shown on packing slips).';
comment on column public.warehouses.name is 'Name.';
comment on column public.warehouses.address is 'Pickup address given to couriers.';
comment on column public.warehouses.city is 'City.';
comment on column public.warehouses.state is 'State (GST registration).';
comment on column public.warehouses.pincode is 'PIN (courier pickup + delivery-time estimate).';
comment on column public.warehouses.is_active is 'FALSE = do not allocate new orders here.';

create table public.inventory (
  variant_id   bigint  not null references public.product_variants(id) on delete cascade,
  warehouse_id integer not null references public.warehouses(id),
  on_hand      integer not null default 0 check (on_hand >= 0),
  reserved     integer not null default 0 check (reserved >= 0),
  available    integer generated always as (on_hand - reserved) stored,
  updated_at   timestamptz not null default now(),
  primary key (variant_id, warehouse_id),
  constraint reserved_not_above_on_hand check (reserved <= on_hand)
);
comment on table public.inventory is 'How many pieces of each SKU each warehouse has. "reserved" = sold but not yet shipped. The database itself refuses to oversell (reserved can never exceed on_hand).';
comment on column public.inventory.variant_id is 'The SKU.';
comment on column public.inventory.warehouse_id is 'The warehouse.';
comment on column public.inventory.on_hand is 'Physical pieces on the shelf.';
comment on column public.inventory.reserved is 'Pieces held for placed/unpaid orders, not yet shipped.';
comment on column public.inventory.available is 'on_hand - reserved = what can still be sold. Calculated automatically.';
comment on column public.inventory.updated_at is 'Last change.';

create table public.inventory_movements (
  id            bigint generated always as identity primary key,
  variant_id    bigint  not null references public.product_variants(id) on delete cascade,
  warehouse_id  integer not null references public.warehouses(id),
  delta         integer not null check (delta <> 0),
  reason        public.stock_reason_t not null,
  order_item_id bigint,
  note          text,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
comment on table public.inventory_movements is 'Append-only history of every change to on_hand (stock in, shipped, returned, damaged). Lets you answer "where did these 5 pieces go?".';
comment on column public.inventory_movements.id is 'Row id.';
comment on column public.inventory_movements.variant_id is 'SKU.';
comment on column public.inventory_movements.warehouse_id is 'Warehouse.';
comment on column public.inventory_movements.delta is '+ pieces added, - pieces removed.';
comment on column public.inventory_movements.reason is 'purchase, sale, return_restock, rto_restock, adjustment, damage, transfer_in/out.';
comment on column public.inventory_movements.order_item_id is 'Order line that caused it (for sale/return/rto).';
comment on column public.inventory_movements.note is 'Free text, e.g. supplier invoice number.';
comment on column public.inventory_movements.created_by is 'Staff user (NULL = system).';
comment on column public.inventory_movements.created_at is 'When.';
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);

create table public.serviceable_pincodes (
  pincode        char(6) primary key,
  city           text not null,
  state          text not null,
  is_serviceable boolean not null default true,
  cod_available  boolean not null default true,
  delivery_days  smallint not null default 5,
  updated_at     timestamptz not null default now()
);
comment on table public.serviceable_pincodes is 'PIN codes you deliver to (load from your courier''s list). Powers "Check delivery" on the product page and blocks checkout to unserviceable PINs.';
comment on column public.serviceable_pincodes.pincode is '6-digit PIN.';
comment on column public.serviceable_pincodes.city is 'City.';
comment on column public.serviceable_pincodes.state is 'State.';
comment on column public.serviceable_pincodes.is_serviceable is 'FALSE = cannot deliver.';
comment on column public.serviceable_pincodes.cod_available is 'FALSE = prepaid only for this PIN.';
comment on column public.serviceable_pincodes.delivery_days is 'Typical days to deliver: "Get it by Tue, 4 Nov".';
comment on column public.serviceable_pincodes.updated_at is 'Last refresh from courier.';

-- =====================================================================
-- SHOPPING (wishlist, bag)
-- =====================================================================
create table public.wishlist_items (
  user_id    uuid   not null references public.profiles(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
comment on table public.wishlist_items is 'Wishlisted products (product level, no size — same as Myntra). The primary key stops duplicates.';
comment on column public.wishlist_items.user_id is 'Owner.';
comment on column public.wishlist_items.product_id is 'Product.';
comment on column public.wishlist_items.created_at is 'Added at (sort newest first).';

create table public.cart_items (
  user_id    uuid   not null references public.profiles(id) on delete cascade,
  variant_id bigint not null references public.product_variants(id) on delete cascade,
  quantity   smallint not null default 1 check (quantity between 1 and 10),
  added_at   timestamptz not null default now(),
  primary key (user_id, variant_id)
);
comment on table public.cart_items is 'The bag. One row per size added. No separate carts table needed: one bag per user. Guests keep their bag on the phone and it is merged here after login.';
comment on column public.cart_items.user_id is 'Owner.';
comment on column public.cart_items.variant_id is 'Product + size.';
comment on column public.cart_items.quantity is '1 to 10 pieces.';
comment on column public.cart_items.added_at is 'Added at.';

-- =====================================================================
-- PROMOTIONS
-- =====================================================================
create table public.coupons (
  id                   integer generated always as identity primary key,
  code                 text not null,
  title                text not null,
  description          text,
  discount_type        public.discount_type_t not null,
  discount_value       integer not null check (discount_value > 0),
  max_discount_paise   integer check (max_discount_paise > 0),
  min_order_paise      integer not null default 0,
  applies_to           jsonb not null default '{}'::jsonb,
  starts_at            timestamptz not null default now(),
  ends_at              timestamptz,
  usage_limit_total    integer,
  usage_limit_per_user smallint not null default 1,
  used_count           integer not null default 0,
  is_public            boolean not null default true,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  constraint percent_max_90 check (discount_type <> 'percent' or discount_value <= 90)
);
comment on table public.coupons is 'Discount codes. Limits (dates, min order, uses, first order only, brand/category) are checked inside checkout, never in the app.';
comment on column public.coupons.id is 'Coupon id.';
comment on column public.coupons.code is 'What the user types, e.g. NEW200. Case-insensitive (unique on UPPER(code)).';
comment on column public.coupons.title is 'Short line in the coupon list, e.g. "Flat ₹200 off on first order".';
comment on column public.coupons.description is 'Terms shown under the coupon.';
comment on column public.coupons.discount_type is 'percent or flat.';
comment on column public.coupons.discount_value is 'Percent (1-90) for percent coupons, or paise for flat coupons (20000 = ₹200).';
comment on column public.coupons.max_discount_paise is 'Cap for percent coupons ("10% off up to ₹300").';
comment on column public.coupons.min_order_paise is 'Bag value needed before the coupon works.';
comment on column public.coupons.applies_to is 'Optional limits as JSON: {"brand_ids":[1],"category_ids":[4],"first_order_only":true}. {} = everything.';
comment on column public.coupons.starts_at is 'Valid from.';
comment on column public.coupons.ends_at is 'Valid until (NULL = no end).';
comment on column public.coupons.usage_limit_total is 'Total uses across all users (NULL = unlimited).';
comment on column public.coupons.usage_limit_per_user is 'Uses per user.';
comment on column public.coupons.used_count is 'Uses so far (updated by checkout; restored if the order is cancelled).';
comment on column public.coupons.is_public is 'TRUE = listed on the "Apply coupon" screen. FALSE = secret code (influencer/support codes).';
comment on column public.coupons.is_active is 'Switch off instantly.';
comment on column public.coupons.created_at is 'Created at.';
create unique index coupons_code_upper_key on public.coupons (upper(code));

-- =====================================================================
-- ORDERS
-- =====================================================================
create sequence public.order_number_seq start 100001;
create sequence public.return_number_seq start 100001;

create table public.orders (
  id                      bigint generated always as identity primary key,
  order_number            text not null unique default ('ORD' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || nextval('public.order_number_seq')),
  user_id                 uuid not null references public.profiles(id),
  order_type              public.order_type_t not null default 'regular',
  parent_order_id         bigint references public.orders(id),
  status                  public.order_status_t not null default 'pending_payment',
  payment_method          public.payment_method_t not null,
  shipping_address        jsonb not null,
  shipping_pincode        char(6) not null,
  item_count              smallint not null default 0,
  total_mrp_paise         integer not null default 0,
  product_discount_paise  integer not null default 0,
  coupon_id               integer references public.coupons(id),
  coupon_code             text,
  coupon_discount_paise   integer not null default 0,
  shipping_fee_paise      integer not null default 0,
  cod_fee_paise           integer not null default 0,
  platform_fee_paise      integer not null default 0,
  store_credit_used_paise integer not null default 0,
  total_paise             integer not null default 0,
  tax_paise               integer not null default 0,
  placed_at               timestamptz,
  expires_at              timestamptz,
  cancelled_at            timestamptz,
  cancel_reason           text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint total_adds_up check (
    total_paise = total_mrp_paise - product_discount_paise - coupon_discount_paise
                + shipping_fee_paise + cod_fee_paise + platform_fee_paise - store_credit_used_paise),
  constraint total_not_negative check (total_paise >= 0)
);
comment on table public.orders is 'One checkout. Holds the money summary and a frozen copy of the address. Items, payments, shipments and returns hang off it. Only the place_order() function creates rows here.';
comment on column public.orders.id is 'Internal order id.';
comment on column public.orders.order_number is 'Customer-facing number like ORD261030100001 (date + running number).';
comment on column public.orders.user_id is 'Customer.';
comment on column public.orders.order_type is 'regular, or exchange (a ₹0 replacement created by a size exchange).';
comment on column public.orders.parent_order_id is 'For exchange orders: the original order.';
comment on column public.orders.status is 'pending_payment -> placed -> completed, or cancelled. Item-level progress is in order_items.status.';
comment on column public.orders.payment_method is 'upi, card, netbanking, wallet, cod, or store_credit (fully paid by store credit).';
comment on column public.orders.shipping_address is 'Frozen JSON copy of the address at checkout (name, phone, lines, city, state, pincode).';
comment on column public.orders.shipping_pincode is 'Copied out of the address for reports ("orders by city").';
comment on column public.orders.item_count is 'Total pieces.';
comment on column public.orders.total_mrp_paise is 'Sum of MRP x qty ("Total MRP" in price details).';
comment on column public.orders.product_discount_paise is 'MRP minus selling price ("Discount on MRP").';
comment on column public.orders.coupon_id is 'Coupon used, if any.';
comment on column public.orders.coupon_code is 'Code as applied (kept even if the coupon is later deleted).';
comment on column public.orders.coupon_discount_paise is 'Coupon discount on the whole order.';
comment on column public.orders.shipping_fee_paise is 'Shipping charged (0 above the free-shipping value).';
comment on column public.orders.cod_fee_paise is 'COD fee charged.';
comment on column public.orders.platform_fee_paise is 'Platform fee charged.';
comment on column public.orders.store_credit_used_paise is 'Store credit applied.';
comment on column public.orders.total_paise is 'Amount the customer pays online / in cash. A check constraint guarantees it equals the sum of the parts above.';
comment on column public.orders.tax_paise is 'GST included in the total (for the invoice; prices are GST-inclusive).';
comment on column public.orders.placed_at is 'When payment succeeded (or COD confirmed).';
comment on column public.orders.expires_at is 'Unpaid prepaid orders are cancelled after this and stock released.';
comment on column public.orders.cancelled_at is 'When cancelled.';
comment on column public.orders.cancel_reason is 'Why (user reason, payment timeout...).';
comment on column public.orders.created_at is 'Created at.';
comment on column public.orders.updated_at is 'Last change.';
create index orders_user_idx    on public.orders (user_id, created_at desc);
create index orders_pending_idx on public.orders (expires_at) where status = 'pending_payment';
create index orders_created_idx on public.orders (created_at);

create table public.shipments (
  id               bigint generated always as identity primary key,
  order_id         bigint  not null references public.orders(id),
  warehouse_id     integer not null references public.warehouses(id),
  courier          text,
  awb_number       text unique,
  tracking_url     text,
  status           public.shipment_status_t not null default 'created',
  cod_amount_paise integer not null default 0,
  tracking_events  jsonb not null default '[]'::jsonb,
  label_key        text,
  shipped_at       timestamptz,
  delivered_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.shipments is 'One parcel. An order can split into several parcels (different warehouses); each order item points to its parcel. Courier tracking events are kept as JSON.';
comment on column public.shipments.id is 'Shipment id.';
comment on column public.shipments.order_id is 'Order.';
comment on column public.shipments.warehouse_id is 'Shipped from.';
comment on column public.shipments.courier is 'Courier name, e.g. Delhivery, Xpressbees (or aggregator like Shiprocket).';
comment on column public.shipments.awb_number is 'Courier tracking number (Air Waybill).';
comment on column public.shipments.tracking_url is 'Courier tracking page link.';
comment on column public.shipments.status is 'created -> picked_up -> in_transit -> out_for_delivery -> delivered (or rto_* / lost).';
comment on column public.shipments.cod_amount_paise is 'Cash the courier must collect for this parcel (0 for prepaid).';
comment on column public.shipments.tracking_events is 'JSON list of scans: [{"at":"2026-10-31T10:00:00Z","status":"In transit","location":"Bengaluru Hub"}].';
comment on column public.shipments.label_key is 'Storage key of the shipping label PDF.';
comment on column public.shipments.shipped_at is 'Courier picked up.';
comment on column public.shipments.delivered_at is 'Delivered.';
comment on column public.shipments.created_at is 'Created at.';
comment on column public.shipments.updated_at is 'Last change.';
create index shipments_order_idx on public.shipments (order_id);

create table public.order_items (
  id                    bigint generated always as identity primary key,
  order_id              bigint  not null references public.orders(id) on delete cascade,
  variant_id            bigint  not null references public.product_variants(id),
  product_id            bigint  not null references public.products(id),
  warehouse_id          integer not null references public.warehouses(id),
  shipment_id           bigint references public.shipments(id),
  sku                   text not null,
  title                 text not null,
  brand_name            text not null,
  size_label            text not null,
  color_name            text not null,
  image_key             text,
  hsn_code              text,
  quantity              smallint not null check (quantity between 1 and 10),
  unit_mrp_paise        integer not null,
  unit_price_paise      integer not null,
  coupon_share_paise    integer not null default 0,
  line_total_paise      integer generated always as (unit_price_paise * quantity - coupon_share_paise) stored,
  tax_rate              numeric(4,2) not null default 0,
  tax_paise             integer not null default 0,
  status                public.item_status_t not null default 'pending_payment',
  is_returnable         boolean not null default true,
  delivered_at          timestamptz,
  return_window_ends_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint coupon_share_ok check (coupon_share_paise >= 0 and coupon_share_paise <= unit_price_paise * quantity)
);
comment on table public.order_items is 'One line per size bought. Copies title/brand/size/color/price at purchase time, so old orders look right even after products change. Each line has its own status (Myntra ships, cancels and returns per item).';
comment on column public.order_items.id is 'Order item id (cancel, return and review use this).';
comment on column public.order_items.order_id is 'Order.';
comment on column public.order_items.variant_id is 'SKU bought.';
comment on column public.order_items.product_id is 'Product (copied for quick joins, e.g. "Buy again").';
comment on column public.order_items.warehouse_id is 'Warehouse stock was reserved from.';
comment on column public.order_items.shipment_id is 'Parcel this line ships in (NULL until packed).';
comment on column public.order_items.sku is 'Copy of SKU.';
comment on column public.order_items.title is 'Copy of product title.';
comment on column public.order_items.brand_name is 'Copy of brand name.';
comment on column public.order_items.size_label is 'Copy of size, e.g. "M".';
comment on column public.order_items.color_name is 'Copy of color.';
comment on column public.order_items.image_key is 'Copy of the main image key.';
comment on column public.order_items.hsn_code is 'Copy of HSN code (invoice).';
comment on column public.order_items.quantity is 'Pieces.';
comment on column public.order_items.unit_mrp_paise is 'MRP per piece at purchase.';
comment on column public.order_items.unit_price_paise is 'Selling price per piece at purchase (0 on exchange replacements).';
comment on column public.order_items.coupon_share_paise is 'This line''s share of the order coupon. Needed so a partial cancel/return refunds the right amount.';
comment on column public.order_items.line_total_paise is 'What the customer actually paid for this line = price x qty - coupon share. Calculated automatically.';
comment on column public.order_items.tax_rate is 'GST % applied (5.00 or 18.00).';
comment on column public.order_items.tax_paise is 'GST included in line_total (for the invoice).';
comment on column public.order_items.status is 'pending_payment, placed, packed, shipped, out_for_delivery, delivered, cancelled, return_requested, returned, exchanged, rto.';
comment on column public.order_items.is_returnable is 'FALSE for innerwear / final-sale / exchange replacements.';
comment on column public.order_items.delivered_at is 'Delivered at.';
comment on column public.order_items.return_window_ends_at is 'Last moment to request a return (delivered_at + return_window_days).';
comment on column public.order_items.created_at is 'Created at.';
comment on column public.order_items.updated_at is 'Last change.';
create index order_items_order_idx    on public.order_items (order_id);
create index order_items_product_idx  on public.order_items (product_id, created_at);
create index order_items_shipment_idx on public.order_items (shipment_id) where shipment_id is not null;

create table public.order_status_history (
  id            bigint generated always as identity primary key,
  order_id      bigint not null references public.orders(id) on delete cascade,
  order_item_id bigint references public.order_items(id) on delete cascade,
  from_status   text,
  to_status     text not null,
  note          text,
  changed_by    uuid,
  created_at    timestamptz not null default now()
);
comment on table public.order_status_history is 'Timeline of every status change (written automatically by triggers). Powers the tracking timeline on the order screen and helps support.';
comment on column public.order_status_history.id is 'Row id.';
comment on column public.order_status_history.order_id is 'Order.';
comment on column public.order_status_history.order_item_id is 'Item (NULL = order-level change).';
comment on column public.order_status_history.from_status is 'Old status.';
comment on column public.order_status_history.to_status is 'New status.';
comment on column public.order_status_history.note is 'Optional note.';
comment on column public.order_status_history.changed_by is 'User/staff who caused it (NULL = system/webhook).';
comment on column public.order_status_history.created_at is 'When.';
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.payments (
  id                  bigint generated always as identity primary key,
  order_id            bigint not null references public.orders(id),
  provider            text not null,
  provider_order_id   text,
  provider_payment_id text unique,
  method              public.payment_method_t not null,
  amount_paise        integer not null check (amount_paise > 0),
  status              public.payment_status_t not null default 'created',
  error_code          text,
  error_reason        text,
  raw                 jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.payments is 'Every payment attempt (an order can have a failed UPI try and then a successful card payment). Written only by the payment webhook via apply_payment_webhook().';
comment on column public.payments.id is 'Payment id.';
comment on column public.payments.order_id is 'Order.';
comment on column public.payments.provider is 'razorpay / cashfree / phonepe / courier_cod.';
comment on column public.payments.provider_order_id is 'Gateway''s order id (e.g. order_Nx...).';
comment on column public.payments.provider_payment_id is 'Gateway''s payment id (e.g. pay_Nx...). Unique, so a repeated webhook cannot double-count.';
comment on column public.payments.method is 'upi / card / netbanking / wallet / cod.';
comment on column public.payments.amount_paise is 'Amount.';
comment on column public.payments.status is 'created, authorized, captured, failed, refunded, partially_refunded.';
comment on column public.payments.error_code is 'Gateway error code for failures.';
comment on column public.payments.error_reason is 'Readable failure reason.';
comment on column public.payments.raw is 'Last webhook payload as JSON (for disputes).';
comment on column public.payments.created_at is 'Created at.';
comment on column public.payments.updated_at is 'Last change.';
create index payments_order_idx on public.payments (order_id);

create table public.returns (
  id                  bigint generated always as identity primary key,
  return_number       text not null unique default ('RET' || nextval('public.return_number_seq')),
  order_item_id       bigint not null references public.order_items(id),
  user_id             uuid not null references public.profiles(id),
  type                public.return_type_t not null default 'return',
  quantity            smallint not null default 1 check (quantity >= 1),
  reason              public.return_reason_t not null,
  comment             text,
  image_keys          text[] not null default '{}',
  exchange_variant_id bigint references public.product_variants(id),
  exchange_order_id   bigint references public.orders(id),
  pickup_address      jsonb not null,
  status              public.return_status_t not null default 'requested',
  refund_method       public.refund_method_t,
  refund_amount_paise integer,
  pickup_awb          text,
  qc_notes            text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint exchange_needs_variant check (type <> 'exchange' or exchange_variant_id is not null)
);
comment on table public.returns is 'Return or size-exchange requests for an order item, from request to pickup, quality check and refund/replacement.';
comment on column public.returns.id is 'Return id.';
comment on column public.returns.return_number is 'Customer-facing number like RET100001.';
comment on column public.returns.order_item_id is 'Item being returned.';
comment on column public.returns.user_id is 'Customer.';
comment on column public.returns.type is 'return (money back) or exchange (different size).';
comment on column public.returns.quantity is 'Pieces returned (up to the line quantity).';
comment on column public.returns.reason is 'size_too_small, size_too_large, damaged, wrong_item, quality_issue, not_as_described, changed_mind.';
comment on column public.returns.comment is 'Customer''s note.';
comment on column public.returns.image_keys is 'Photos uploaded by the customer (needed for damaged/wrong item).';
comment on column public.returns.exchange_variant_id is 'New size wanted (exchange only; same product).';
comment on column public.returns.exchange_order_id is 'The ₹0 replacement order created when the exchange completes.';
comment on column public.returns.pickup_address is 'Address copy for the reverse pickup.';
comment on column public.returns.status is 'requested -> approved -> pickup_scheduled -> picked_up -> received -> refunded / exchanged (or rejected, qc_failed, cancelled).';
comment on column public.returns.refund_method is 'original_payment, store_credit or bank_transfer (COD orders cannot use original_payment).';
comment on column public.returns.refund_amount_paise is 'Amount refunded (filled when refunded).';
comment on column public.returns.pickup_awb is 'Reverse-pickup tracking number.';
comment on column public.returns.qc_notes is 'Warehouse quality-check notes.';
comment on column public.returns.created_at is 'Requested at.';
comment on column public.returns.updated_at is 'Last change.';
create unique index returns_one_open_per_item on public.returns (order_item_id) where status not in ('rejected','cancelled','qc_failed');
create index returns_user_idx on public.returns (user_id, created_at desc);

create table public.refunds (
  id                 bigint generated always as identity primary key,
  order_id           bigint not null references public.orders(id),
  order_item_id      bigint references public.order_items(id),
  return_id          bigint references public.returns(id),
  payment_id         bigint references public.payments(id),
  amount_paise       integer not null check (amount_paise > 0),
  method             public.refund_method_t not null,
  provider_refund_id text unique,
  status             public.refund_status_t not null default 'pending',
  created_at         timestamptz not null default now(),
  processed_at       timestamptz
);
comment on table public.refunds is 'Money going back to the customer (cancellations, returns, late payments, RTO). Gateway refunds start pending and are completed by a server function; store-credit refunds complete instantly.';
comment on column public.refunds.id is 'Refund id.';
comment on column public.refunds.order_id is 'Order.';
comment on column public.refunds.order_item_id is 'Item (NULL = order-level, e.g. shipping fee).';
comment on column public.refunds.return_id is 'Return that caused it (if any).';
comment on column public.refunds.payment_id is 'Payment refunded against (gateway refunds).';
comment on column public.refunds.amount_paise is 'Amount.';
comment on column public.refunds.method is 'original_payment, store_credit, bank_transfer.';
comment on column public.refunds.provider_refund_id is 'Gateway refund id (rfnd_...).';
comment on column public.refunds.status is 'pending, processed, failed.';
comment on column public.refunds.created_at is 'Created at.';
comment on column public.refunds.processed_at is 'Completed at.';
create index refunds_order_idx on public.refunds (order_id);
create index refunds_pending_idx on public.refunds (created_at) where status = 'pending';

create table public.coupon_redemptions (
  id             bigint generated always as identity primary key,
  coupon_id      integer not null references public.coupons(id),
  user_id        uuid not null references public.profiles(id),
  order_id       bigint not null unique references public.orders(id) on delete cascade,
  discount_paise integer not null,
  created_at     timestamptz not null default now()
);
comment on table public.coupon_redemptions is 'Who used which coupon on which order. Used to enforce "1 use per user". Deleted again if the order is cancelled before payment.';
comment on column public.coupon_redemptions.id is 'Row id.';
comment on column public.coupon_redemptions.coupon_id is 'Coupon.';
comment on column public.coupon_redemptions.user_id is 'Customer.';
comment on column public.coupon_redemptions.order_id is 'Order (one coupon per order).';
comment on column public.coupon_redemptions.discount_paise is 'Discount given.';
comment on column public.coupon_redemptions.created_at is 'When.';
create index coupon_redemptions_user_idx on public.coupon_redemptions (coupon_id, user_id);

create table public.wallet_transactions (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id),
  amount_paise integer not null check (amount_paise <> 0),
  reason       public.wallet_reason_t not null,
  order_id     bigint references public.orders(id),
  refund_id    bigint references public.refunds(id),
  expires_at   timestamptz,
  note         text,
  created_at   timestamptz not null default now()
);
comment on table public.wallet_transactions is 'Store credit ledger (like "Myntra Credit"). Never edit a balance: add a + or - row. Balance = SUM(amount_paise).';
comment on column public.wallet_transactions.id is 'Row id.';
comment on column public.wallet_transactions.user_id is 'Customer.';
comment on column public.wallet_transactions.amount_paise is '+ credit added, - credit spent.';
comment on column public.wallet_transactions.reason is 'refund, cashback, order_payment, order_cancel_reversal, admin_adjust, expiry.';
comment on column public.wallet_transactions.order_id is 'Related order.';
comment on column public.wallet_transactions.refund_id is 'Related refund.';
comment on column public.wallet_transactions.expires_at is 'For promotional credit: when it lapses (a job then adds a matching - row).';
comment on column public.wallet_transactions.note is 'Shown in the credit history.';
comment on column public.wallet_transactions.created_at is 'When.';
create index wallet_transactions_user_idx on public.wallet_transactions (user_id, created_at desc);

-- =====================================================================
-- REVIEWS
-- =====================================================================
create table public.reviews (
  id            bigint generated always as identity primary key,
  product_id    bigint not null references public.products(id) on delete cascade,
  user_id       uuid   not null references public.profiles(id) on delete cascade,
  order_item_id bigint unique references public.order_items(id),
  rating        smallint not null check (rating between 1 and 5),
  title         text,
  body          text,
  fit_feedback  public.fit_feedback_t,
  image_keys    text[] not null default '{}',
  helpful_count integer not null default 0,
  status        public.review_status_t not null default 'published',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (product_id, user_id)
);
comment on table public.reviews is 'Ratings and reviews, only from verified buyers (security rule checks a delivered order item). Product rating_avg/rating_count update automatically.';
comment on column public.reviews.id is 'Review id.';
comment on column public.reviews.product_id is 'Product.';
comment on column public.reviews.user_id is 'Reviewer.';
comment on column public.reviews.order_item_id is 'The purchase that proves they bought it.';
comment on column public.reviews.rating is '1 to 5 stars.';
comment on column public.reviews.title is 'Optional headline.';
comment on column public.reviews.body is 'Review text.';
comment on column public.reviews.fit_feedback is 'runs_small / true_to_size / runs_large — very useful for clothing ("Most say: true to size").';
comment on column public.reviews.image_keys is 'Customer photos.';
comment on column public.reviews.helpful_count is '"Helpful" taps.';
comment on column public.reviews.status is 'pending, published or rejected (moderation).';
comment on column public.reviews.created_at is 'Written at.';
comment on column public.reviews.updated_at is 'Last edit.';
create index reviews_product_idx on public.reviews (product_id, created_at desc) where status = 'published';

-- =====================================================================
-- MERCHANDISING (home screen)
-- =====================================================================
create table public.collections (
  id          integer generated always as identity primary key,
  name        text not null,
  slug        text not null unique,
  description text,
  image_key   text,
  is_active   boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz not null default now()
);
comment on table public.collections is 'Hand-picked product sets like "Diwali Edit" or "Under ₹499". Banners can link to them.';
comment on column public.collections.id is 'Collection id.';
comment on column public.collections.name is 'Title.';
comment on column public.collections.slug is 'URL name.';
comment on column public.collections.description is 'Subtitle.';
comment on column public.collections.image_key is 'Cover image.';
comment on column public.collections.is_active is 'Visible.';
comment on column public.collections.starts_at is 'Show from (NULL = now).';
comment on column public.collections.ends_at is 'Show until (NULL = always).';
comment on column public.collections.created_at is 'Created at.';

create table public.collection_products (
  collection_id integer not null references public.collections(id) on delete cascade,
  product_id    bigint  not null references public.products(id) on delete cascade,
  sort_order    smallint not null default 0,
  primary key (collection_id, product_id)
);
comment on table public.collection_products is 'Which products are in which collection, and their order.';
comment on column public.collection_products.collection_id is 'Collection.';
comment on column public.collection_products.product_id is 'Product.';
comment on column public.collection_products.sort_order is 'Position in the collection.';
create index collection_products_product_idx on public.collection_products (product_id);

create table public.home_banners (
  id         integer generated always as identity primary key,
  title      text not null,
  image_key  text not null,
  placement  text not null default 'home_top',
  gender     public.gender_t,
  link_type  public.banner_link_t not null,
  link_value text not null,
  sort_order smallint not null default 0,
  starts_at  timestamptz,
  ends_at    timestamptz,
  is_active  boolean not null default true
);
comment on table public.home_banners is 'Home-screen banners and carousels. Change the home page from the admin side without releasing a new app.';
comment on column public.home_banners.id is 'Banner id.';
comment on column public.home_banners.title is 'Alt text / internal name.';
comment on column public.home_banners.image_key is 'Banner image key.';
comment on column public.home_banners.placement is 'Where it shows: home_top, home_mid, category_top...';
comment on column public.home_banners.gender is 'Show only in the Men/Women tab (NULL = all).';
comment on column public.home_banners.link_type is 'What a tap opens: category, brand, product, collection, search, url.';
comment on column public.home_banners.link_value is 'Target: an id, slug, search text or URL.';
comment on column public.home_banners.sort_order is 'Carousel order.';
comment on column public.home_banners.starts_at is 'Show from.';
comment on column public.home_banners.ends_at is 'Show until.';
comment on column public.home_banners.is_active is 'Switch off instantly.';

-- =====================================================================
-- NOTIFICATIONS
-- =====================================================================
create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.notifications is 'In-app notification inbox (order placed, shipped, refund done...). Rows are added by the order functions; a server function can also push them via FCM.';
comment on column public.notifications.id is 'Row id.';
comment on column public.notifications.user_id is 'Recipient.';
comment on column public.notifications.type is 'order_placed, order_shipped, order_delivered, refund, return_update, price_drop, offer...';
comment on column public.notifications.title is 'Headline.';
comment on column public.notifications.body is 'Text.';
comment on column public.notifications.data is 'Where a tap goes, e.g. {"order_id":123}.';
comment on column public.notifications.read_at is 'NULL = unread (badge count).';
comment on column public.notifications.created_at is 'When.';
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- =====================================================================
--  Part 2 of 3: helper functions, triggers, and the app-facing functions
--  (checkout, payments, shipping, cancellations, returns, search)
--  App calls public functions with: supabase.rpc('function_name', params: {...})
-- =====================================================================

-- ---------------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------------
create or replace function private.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

create or replace function private.is_staff(p_role public.staff_role_t default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid()
      and (p_role is null or s.role = p_role or s.role = 'admin'))
$$;

create or replace function private.is_service() returns boolean
language sql stable set search_path = public as $$ select coalesce(auth.role(), '') = 'service_role' $$;

create or replace function private.notify(p_user uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, data) values (p_user, p_type, p_title, p_body, p_data)
$$;

create or replace function private.gst_rate(p_unit_value_paise integer, p_hsn text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((
    select t.rate from public.tax_slabs t
    where current_date >= t.valid_from and (t.valid_to is null or current_date <= t.valid_to)
      and p_unit_value_paise >= t.min_unit_price_paise
      and (t.max_unit_price_paise is null or p_unit_value_paise <= t.max_unit_price_paise)
      and (t.hsn_prefix is null or coalesce(p_hsn, '') like t.hsn_prefix || '%')
    order by (t.hsn_prefix is null), t.valid_from desc
    limit 1), 0)
$$;

-- ---------------------------------------------------------------------
-- Triggers that keep derived data correct
-- ---------------------------------------------------------------------
-- New Supabase Auth user -> profile row
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, phone, full_name)
  values (new.id, new.email, new.phone, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Category tree path/level
create or replace function private.categories_set_path() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.parent_id is null then
    new.path_ids := array[new.id];
  else
    select c.path_ids || new.id into new.path_ids from public.categories c where c.id = new.parent_id;
    if new.id = any (new.path_ids[1:cardinality(new.path_ids) - 1]) then
      raise exception 'A category cannot be inside itself';
    end if;
  end if;
  new.level := cardinality(new.path_ids) - 1;
  return new;
end $$;
create trigger categories_path before insert or update of parent_id on public.categories
  for each row execute function private.categories_set_path();

-- Product search text (title + brand + category + color + attributes + tags)
create or replace function private.products_set_search() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_brand text; v_cat text; v_color text; v_family text; v_attrs text;
begin
  select name into v_brand from public.brands where id = new.brand_id;
  select name into v_cat from public.categories where id = new.category_id;
  select name, family into v_color, v_family from public.colors where id = new.color_id;
  select string_agg(value, ' ') into v_attrs from jsonb_each_text(new.attributes);
  new.search_vector :=
       setweight(to_tsvector('english', coalesce(new.title, '') || ' ' || coalesce(v_brand, '')), 'A')
    || setweight(to_tsvector('english', coalesce(v_cat, '') || ' ' || coalesce(v_color, '') || ' ' || coalesce(v_family, '')
                                         || ' ' || new.gender::text || ' ' || array_to_string(new.tags, ' ')), 'B')
    || setweight(to_tsvector('english', coalesce(v_attrs, '')), 'C')
    || setweight(to_tsvector('english', coalesce(new.description, '')), 'D');
  if new.status = 'active' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
create trigger products_search before insert or update of title, description, attributes, brand_id, category_id, color_id, tags, gender, status
  on public.products for each row execute function private.products_set_search();

-- Product listing stock fields (available_size_ids, in_stock)
create or replace function private.refresh_product_stock(p_product_id bigint) returns void
language sql security definer set search_path = public as $$
  update public.products p
     set available_size_ids = s.ids, in_stock = cardinality(s.ids) > 0
    from (select coalesce(array_agg(distinct v.size_id order by v.size_id), '{}') as ids
            from public.product_variants v
            join public.inventory i on i.variant_id = v.id and i.available > 0
            join public.warehouses w on w.id = i.warehouse_id and w.is_active
           where v.product_id = p_product_id and v.is_active) s
   where p.id = p_product_id and p.available_size_ids is distinct from s.ids
$$;

create or replace function private.inventory_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_product bigint;
begin
  select product_id into v_product from public.product_variants where id = coalesce(new.variant_id, old.variant_id);
  if v_product is not null then perform private.refresh_product_stock(v_product); end if;
  return null;
end $$;
create trigger inventory_refresh_product after insert or update or delete on public.inventory
  for each row execute function private.inventory_changed();

create or replace function private.variant_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform private.refresh_product_stock(new.product_id); return null; end $$;
create trigger variants_refresh_product after update of is_active on public.product_variants
  for each row execute function private.variant_changed();

-- Product rating
create or replace function private.refresh_product_rating(p_product_id bigint) returns void
language sql security definer set search_path = public as $$
  update public.products p
     set rating_avg = coalesce(s.avg, 0), rating_count = s.cnt
    from (select round(avg(rating), 1) as avg, count(*)::int as cnt
            from public.reviews where product_id = p_product_id and status = 'published') s
   where p.id = p_product_id
$$;

create or replace function private.reviews_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.refresh_product_rating(coalesce(new.product_id, old.product_id));
  return null;
end $$;
create trigger reviews_refresh_rating after insert or update of rating, status or delete on public.reviews
  for each row execute function private.reviews_changed();

-- Status timeline
create or replace function private.log_item_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.order_status_history (order_id, order_item_id, from_status, to_status, changed_by)
  values (new.order_id, new.id, old.status::text, new.status::text, auth.uid());
  return null;
end $$;
create trigger order_items_status_log after update of status on public.order_items
  for each row when (old.status is distinct from new.status) execute function private.log_item_status();

create or replace function private.log_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.order_status_history (order_id, from_status, to_status, note, changed_by)
  values (new.id, case when tg_op = 'UPDATE' then old.status::text end, new.status::text,
          case when new.status = 'cancelled' then new.cancel_reason end, auth.uid());
  return null;
end $$;
create trigger orders_status_log_insert after insert on public.orders
  for each row execute function private.log_order_status();
create trigger orders_status_log_update after update of status on public.orders
  for each row when (old.status is distinct from new.status) execute function private.log_order_status();

-- updated_at on every table that has it
do $$
declare t text;
begin
  for t in select c.table_name from information_schema.columns c
           where c.table_schema = 'public' and c.column_name = 'updated_at'
             and c.table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE')
  loop
    execute format('create trigger %I before update on public.%I for each row execute function private.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Stock helpers (never called by the app directly)
-- ---------------------------------------------------------------------
-- Reserve p_qty pieces from the warehouse with the most available stock.
-- Row lock (FOR UPDATE) means two buyers can never take the last piece twice.
create or replace function private.reserve_stock(p_variant_id bigint, p_qty integer) returns integer
language plpgsql security definer set search_path = public as $$
declare v_wh integer;
begin
  select i.warehouse_id into v_wh
    from public.inventory i
    join public.warehouses w on w.id = i.warehouse_id and w.is_active
   where i.variant_id = p_variant_id and i.available >= p_qty
   order by i.available desc, i.warehouse_id
   limit 1
   for update of i;
  if v_wh is null then return null; end if;
  update public.inventory set reserved = reserved + p_qty, updated_at = now()
   where variant_id = p_variant_id and warehouse_id = v_wh;
  return v_wh;
end $$;

create or replace function private.release_stock(p_variant_id bigint, p_warehouse_id integer, p_qty integer) returns void
language sql security definer set search_path = public as $$
  update public.inventory set reserved = reserved - p_qty, updated_at = now()
   where variant_id = p_variant_id and warehouse_id = p_warehouse_id
$$;

-- Item leaves the warehouse: physical stock and reservation both go down.
create or replace function private.commit_stock(p_item_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare it record;
begin
  select variant_id, warehouse_id, quantity into it from public.order_items where id = p_item_id;
  update public.inventory set on_hand = on_hand - it.quantity, reserved = reserved - it.quantity, updated_at = now()
   where variant_id = it.variant_id and warehouse_id = it.warehouse_id;
  insert into public.inventory_movements (variant_id, warehouse_id, delta, reason, order_item_id, created_by)
  values (it.variant_id, it.warehouse_id, -it.quantity, 'sale', p_item_id, auth.uid());
end $$;

-- Pieces come back to the shelf (return passed QC, or courier RTO).
create or replace function private.restock(p_item_id bigint, p_qty integer, p_reason public.stock_reason_t) returns void
language plpgsql security definer set search_path = public as $$
declare it record;
begin
  select variant_id, warehouse_id into it from public.order_items where id = p_item_id;
  insert into public.inventory (variant_id, warehouse_id, on_hand) values (it.variant_id, it.warehouse_id, p_qty)
  on conflict (variant_id, warehouse_id) do update set on_hand = public.inventory.on_hand + excluded.on_hand, updated_at = now();
  insert into public.inventory_movements (variant_id, warehouse_id, delta, reason, order_item_id, created_by)
  values (it.variant_id, it.warehouse_id, p_qty, p_reason, p_item_id, auth.uid());
end $$;

-- ---------------------------------------------------------------------
-- Refunds: money goes back to the gateway up to what was actually paid,
-- anything above that (store credit that was used) goes back as store credit.
-- ---------------------------------------------------------------------
create or replace function private.issue_refund(
  p_order_id bigint, p_item_id bigint, p_return_id bigint, p_amount integer, p_method public.refund_method_t)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid; v_pay record; v_refundable integer := 0; v_gateway integer := 0; v_credit integer := 0; v_refund_id bigint;
begin
  if p_amount is null or p_amount <= 0 then return; end if;
  select user_id into v_user from public.orders where id = p_order_id;

  if p_method = 'original_payment' then
    select p.id, p.amount_paise - coalesce((select sum(r.amount_paise) from public.refunds r
                                             where r.payment_id = p.id and r.status <> 'failed'), 0) as left_paise
      into v_pay
      from public.payments p
     where p.order_id = p_order_id and p.status in ('captured','partially_refunded') and p.method <> 'cod'
     order by p.id desc limit 1;
    v_refundable := greatest(coalesce(v_pay.left_paise, 0), 0);
    v_gateway := least(p_amount, v_refundable);
    v_credit := p_amount - v_gateway;
  elsif p_method = 'store_credit' then
    v_credit := p_amount;
  else  -- bank_transfer: support pays manually and marks processed
    insert into public.refunds (order_id, order_item_id, return_id, amount_paise, method)
    values (p_order_id, p_item_id, p_return_id, p_amount, 'bank_transfer');
  end if;

  if v_gateway > 0 then
    insert into public.refunds (order_id, order_item_id, return_id, payment_id, amount_paise, method)
    values (p_order_id, p_item_id, p_return_id, v_pay.id, v_gateway, 'original_payment');
  end if;

  if v_credit > 0 then
    insert into public.refunds (order_id, order_item_id, return_id, amount_paise, method, status, processed_at)
    values (p_order_id, p_item_id, p_return_id, v_credit, 'store_credit', 'processed', now())
    returning id into v_refund_id;
    insert into public.wallet_transactions (user_id, amount_paise, reason, order_id, refund_id, note)
    values (v_user, v_credit, 'refund', p_order_id, v_refund_id, 'Refund to store credit');
  end if;

  perform private.notify(v_user, 'refund', 'Refund initiated',
          format('₹%s is on its way back to you.', to_char(p_amount / 100.0, 'FM999G99G990D00')),
          jsonb_build_object('order_id', p_order_id));
end $$;

-- Cancel an order that was never paid: release stock, give back coupon and store credit.
create or replace function private.void_unpaid_order(p_order_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare o record; it record;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.status <> 'pending_payment' then return; end if;
  for it in select id, variant_id, warehouse_id, quantity from public.order_items where order_id = p_order_id and status = 'pending_payment' loop
    perform private.release_stock(it.variant_id, it.warehouse_id, it.quantity);
  end loop;
  update public.order_items set status = 'cancelled' where order_id = p_order_id and status = 'pending_payment';
  update public.orders set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason, expires_at = null where id = p_order_id;
  if o.coupon_id is not null then
    update public.coupons set used_count = greatest(used_count - 1, 0) where id = o.coupon_id;
    delete from public.coupon_redemptions where order_id = p_order_id;
  end if;
  if o.store_credit_used_paise > 0 then
    insert into public.wallet_transactions (user_id, amount_paise, reason, order_id, note)
    values (o.user_id, o.store_credit_used_paise, 'order_cancel_reversal', p_order_id, 'Store credit returned: order ' || o.order_number || ' cancelled');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Pricing: ONE function computes the bag (used by both the bag screen and checkout)
-- ---------------------------------------------------------------------
create or replace function private.price_cart(
  p_user uuid, p_coupon_code text, p_payment_method public.payment_method_t, p_strict boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_set public.store_settings%rowtype;
  v_coupon public.coupons%rowtype;
  v_coupon_error text;
  v_lines jsonb := '[]'::jsonb;
  r record;
  v_unit_mrp integer; v_unit_price integer; v_eligible_flag boolean;
  v_total_mrp integer := 0; v_total_price integer := 0; v_count integer := 0;
  v_eligible integer := 0; v_disc integer := 0; v_left integer; v_share integer;
  v_last_idx integer := -1; i integer;
  v_after integer; v_ship integer := 0; v_cod integer := 0; v_platform integer;
begin
  select * into v_set from public.store_settings where id;

  if p_coupon_code is not null and btrim(p_coupon_code) <> '' then
    select * into v_coupon from public.coupons where upper(code) = upper(btrim(p_coupon_code));
    if not found or not v_coupon.is_active or now() < v_coupon.starts_at
       or (v_coupon.ends_at is not null and now() > v_coupon.ends_at) then
      v_coupon_error := format('Coupon %s is not valid', upper(btrim(p_coupon_code)));
    elsif v_coupon.usage_limit_total is not null and v_coupon.used_count >= v_coupon.usage_limit_total then
      v_coupon_error := format('Coupon %s has been fully used', v_coupon.code);
    elsif (select count(*) from public.coupon_redemptions cr where cr.coupon_id = v_coupon.id and cr.user_id = p_user) >= v_coupon.usage_limit_per_user then
      v_coupon_error := format('You have already used coupon %s', v_coupon.code);
    elsif coalesce((v_coupon.applies_to ->> 'first_order_only')::boolean, false)
          and exists (select 1 from public.orders o where o.user_id = p_user and o.status in ('placed','completed') and o.order_type = 'regular') then
      v_coupon_error := format('Coupon %s is only for your first order', v_coupon.code);
    end if;
    if v_coupon_error is not null then v_coupon := null; end if;
  end if;

  i := 0;
  for r in
    select ci.variant_id, ci.quantity, v.sku, v.is_active as variant_active, v.mrp_paise_override, v.price_paise_override,
           p.id as product_id, p.title, p.status, p.mrp_paise, p.price_paise, p.images[1] as image_key, p.hsn_code,
           p.brand_id, p.category_id, b.name as brand_name, s.label as size_label, co.name as color_name,
           coalesce((select sum(inv.available) from public.inventory inv where inv.variant_id = v.id), 0) as available
      from public.cart_items ci
      join public.product_variants v on v.id = ci.variant_id
      join public.products p on p.id = v.product_id
      join public.brands b on b.id = p.brand_id
      join public.sizes s on s.id = v.size_id
      join public.colors co on co.id = p.color_id
     where ci.user_id = p_user
     order by ci.variant_id
  loop
    v_unit_mrp := coalesce(r.mrp_paise_override, r.mrp_paise);
    v_unit_price := coalesce(r.price_paise_override, r.price_paise);
    v_eligible_flag := v_coupon.id is not null
      and (v_coupon.applies_to -> 'brand_ids' is null or v_coupon.applies_to -> 'brand_ids' @> to_jsonb(r.brand_id))
      and (v_coupon.applies_to -> 'category_ids' is null or exists (
             select 1 from public.categories c where c.id = r.category_id
                and c.path_ids && array(select jsonb_array_elements_text(v_coupon.applies_to -> 'category_ids')::int)));
    v_lines := v_lines || jsonb_build_object(
      'variant_id', r.variant_id, 'product_id', r.product_id, 'quantity', r.quantity, 'sku', r.sku,
      'title', r.title, 'brand_name', r.brand_name, 'size_label', r.size_label, 'color_name', r.color_name,
      'image_key', r.image_key, 'hsn_code', r.hsn_code, 'unit_mrp', v_unit_mrp, 'unit_price', v_unit_price,
      'coupon_share', 0, 'coupon_eligible', v_eligible_flag,
      'is_active', (r.status = 'active' and r.variant_active), 'in_stock', r.available >= r.quantity,
      'available', least(r.available, 10));
    v_total_mrp := v_total_mrp + v_unit_mrp * r.quantity;
    v_total_price := v_total_price + v_unit_price * r.quantity;
    v_count := v_count + r.quantity;
    if v_eligible_flag then v_eligible := v_eligible + v_unit_price * r.quantity; v_last_idx := i; end if;
    i := i + 1;
  end loop;

  if v_coupon.id is not null then
    if v_eligible = 0 then
      v_coupon_error := format('Coupon %s does not apply to the items in your bag', v_coupon.code);
    elsif v_total_price < v_coupon.min_order_paise then
      v_coupon_error := format('Add items worth ₹%s more to use coupon %s',
                               ceil((v_coupon.min_order_paise - v_total_price) / 100.0)::int, v_coupon.code);
    else
      if v_coupon.discount_type = 'percent' then v_disc := floor(v_eligible * v_coupon.discount_value / 100.0);
      else v_disc := v_coupon.discount_value; end if;
      if v_coupon.max_discount_paise is not null then v_disc := least(v_disc, v_coupon.max_discount_paise); end if;
      v_disc := least(v_disc, v_eligible);
      -- split the discount across eligible lines in proportion to their value (last line takes the rounding remainder)
      v_left := v_disc;
      for i in 0 .. jsonb_array_length(v_lines) - 1 loop
        if (v_lines -> i ->> 'coupon_eligible')::boolean then
          if i = v_last_idx then v_share := v_left;
          else v_share := floor(v_disc::numeric * (v_lines -> i ->> 'unit_price')::int * (v_lines -> i ->> 'quantity')::int / v_eligible);
          end if;
          v_lines := jsonb_set(v_lines, array[i::text, 'coupon_share'], to_jsonb(v_share));
          v_left := v_left - v_share;
        end if;
      end loop;
    end if;
    if v_coupon_error is not null then v_disc := 0; end if;
  end if;

  if p_strict and v_coupon_error is not null then raise exception '%', v_coupon_error; end if;

  v_after := v_total_price - v_disc;
  if v_count > 0 and v_after < v_set.free_shipping_min_paise then v_ship := v_set.shipping_fee_paise; end if;
  if p_payment_method = 'cod' then v_cod := v_set.cod_fee_paise; end if;
  v_platform := case when v_count > 0 then v_set.platform_fee_paise else 0 end;

  return jsonb_build_object(
    'lines', v_lines,
    'item_count', v_count,
    'total_mrp', v_total_mrp,
    'product_discount', v_total_mrp - v_total_price,
    'coupon_id', case when v_disc > 0 then v_coupon.id end,
    'coupon_code', case when v_disc > 0 then v_coupon.code end,
    'coupon_discount', v_disc,
    'coupon_error', v_coupon_error,
    'shipping_fee', v_ship,
    'cod_fee', v_cod,
    'platform_fee', v_platform,
    'free_shipping_min', v_set.free_shipping_min_paise,
    'total', v_after + v_ship + v_cod + v_platform);
end $$;

-- =====================================================================
--  APP-FACING FUNCTIONS (customers)
-- =====================================================================

-- Bag screen "Price Details" box. Same maths as checkout, but never fails on a bad coupon.
create or replace function public.cart_summary(p_coupon_code text default null, p_payment_method public.payment_method_t default 'upi')
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  return private.price_cart(auth.uid(), p_coupon_code, p_payment_method, false);
end $$;

create or replace function public.my_store_credit() returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount_paise), 0)::int from public.wallet_transactions where user_id = auth.uid()
$$;

-- CHECKOUT. Everything happens in one transaction: either the whole order is created
-- (stock reserved, coupon used, bag emptied) or nothing changes.
create or replace function public.place_order(
  p_address_id bigint,
  p_payment_method public.payment_method_t,
  p_coupon_code text default null,
  p_use_store_credit boolean default false)
returns table (order_id bigint, order_number text, payable_paise integer, status public.order_status_t)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_addr public.addresses%rowtype;
  v_pin public.serviceable_pincodes%rowtype;
  v_set public.store_settings%rowtype;
  v_cart jsonb;
  v_order public.orders%rowtype;
  r record;
  v_wh integer;
  v_line integer;
  v_rate numeric;
  v_payable integer;
  v_credit integer := 0;
  v_status public.order_status_t;
  v_method public.payment_method_t := p_payment_method;
begin
  if v_user is null then raise exception 'Please sign in to place an order'; end if;
  if p_payment_method = 'store_credit' then raise exception 'To pay with store credit, pick a payment method and set p_use_store_credit = true'; end if;
  if p_payment_method = 'cod' and p_use_store_credit then raise exception 'Store credit cannot be combined with Cash on Delivery'; end if;

  select * into v_set from public.store_settings where id;
  select * into v_addr from public.addresses where id = p_address_id and user_id = v_user;
  if not found then raise exception 'Address not found'; end if;
  select * into v_pin from public.serviceable_pincodes where pincode = v_addr.pincode;
  if not found or not v_pin.is_serviceable then raise exception 'Sorry, we do not deliver to pincode % yet', v_addr.pincode; end if;
  if p_payment_method = 'cod' and not v_pin.cod_available then raise exception 'Cash on Delivery is not available for pincode %', v_addr.pincode; end if;

  -- one checkout at a time per user (stops double-tap orders and double use of store credit/coupons)
  perform 1 from public.profiles where id = v_user for update;

  v_cart := private.price_cart(v_user, p_coupon_code, p_payment_method, true);
  if (v_cart ->> 'item_count')::int = 0 then raise exception 'Your bag is empty'; end if;

  insert into public.orders (user_id, payment_method, shipping_address, shipping_pincode)
  values (v_user, p_payment_method,
          jsonb_build_object('name', v_addr.name, 'phone', v_addr.phone, 'line1', v_addr.line1, 'line2', v_addr.line2,
                             'landmark', v_addr.landmark, 'city', v_addr.city, 'state', v_addr.state,
                             'pincode', v_addr.pincode, 'address_type', v_addr.address_type),
          v_addr.pincode)
  returning * into v_order;

  for r in
    select * from jsonb_to_recordset(v_cart -> 'lines') as x(
      variant_id bigint, product_id bigint, quantity int, sku text, title text, brand_name text, size_label text,
      color_name text, image_key text, hsn_code text, unit_mrp int, unit_price int, coupon_share int, is_active boolean)
    order by variant_id          -- same lock order for everyone = no deadlocks
  loop
    if not r.is_active then
      raise exception '% (size %) is no longer available. Please remove it from your bag.', r.title, r.size_label;
    end if;
    if r.quantity > v_set.max_qty_per_item then
      raise exception 'You can buy at most % pieces of % (size %)', v_set.max_qty_per_item, r.title, r.size_label;
    end if;
    v_wh := private.reserve_stock(r.variant_id, r.quantity);
    if v_wh is null then
      raise exception 'Sorry, % (size %) just went out of stock for quantity %', r.title, r.size_label, r.quantity;
    end if;
    -- GST: rate depends on the per-piece value actually paid; prices are GST-inclusive
    v_line := r.unit_price * r.quantity - r.coupon_share;
    v_rate := private.gst_rate(v_line / r.quantity, r.hsn_code);
    insert into public.order_items (order_id, variant_id, product_id, warehouse_id, sku, title, brand_name, size_label,
                                    color_name, image_key, hsn_code, quantity, unit_mrp_paise, unit_price_paise, coupon_share_paise,
                                    tax_rate, tax_paise)
    values (v_order.id, r.variant_id, r.product_id, v_wh, r.sku, r.title, r.brand_name, r.size_label,
            r.color_name, r.image_key, r.hsn_code, r.quantity, r.unit_mrp, r.unit_price, r.coupon_share,
            v_rate, round(v_line * v_rate / (100 + v_rate)));
  end loop;

  if (v_cart ->> 'coupon_id') is not null then
    -- atomic "use one", so a limited coupon can never go over its limit
    update public.coupons set used_count = used_count + 1
     where id = (v_cart ->> 'coupon_id')::int and (usage_limit_total is null or used_count < usage_limit_total);
    if not found then raise exception 'Coupon % has just been fully used', v_cart ->> 'coupon_code'; end if;
    insert into public.coupon_redemptions (coupon_id, user_id, order_id, discount_paise)
    values ((v_cart ->> 'coupon_id')::int, v_user, v_order.id, (v_cart ->> 'coupon_discount')::int);
  end if;

  v_payable := (v_cart ->> 'total')::int;
  if p_use_store_credit then
    v_credit := greatest(least(public.my_store_credit(), v_payable), 0);
    if v_credit > 0 then
      insert into public.wallet_transactions (user_id, amount_paise, reason, order_id, note)
      values (v_user, -v_credit, 'order_payment', v_order.id, 'Used on order ' || v_order.order_number);
    end if;
  end if;
  v_payable := v_payable - v_credit;

  if v_payable = 0 then v_method := 'store_credit'; end if;
  v_status := case when v_method in ('cod','store_credit') then 'placed' else 'pending_payment' end;

  update public.orders o set
    item_count = (v_cart ->> 'item_count')::int,
    total_mrp_paise = (v_cart ->> 'total_mrp')::int,
    product_discount_paise = (v_cart ->> 'product_discount')::int,
    coupon_id = (v_cart ->> 'coupon_id')::int,
    coupon_code = v_cart ->> 'coupon_code',
    coupon_discount_paise = (v_cart ->> 'coupon_discount')::int,
    shipping_fee_paise = (v_cart ->> 'shipping_fee')::int,
    cod_fee_paise = (v_cart ->> 'cod_fee')::int,
    platform_fee_paise = (v_cart ->> 'platform_fee')::int,
    store_credit_used_paise = v_credit,
    total_paise = v_payable,
    tax_paise = (select coalesce(sum(oi.tax_paise), 0) from public.order_items oi where oi.order_id = v_order.id),
    payment_method = v_method,
    status = v_status,
    placed_at = case when v_status = 'placed' then now() end,
    expires_at = case when v_status = 'pending_payment' then now() + make_interval(mins => v_set.payment_window_minutes) end
  where o.id = v_order.id
  returning * into v_order;

  if v_status = 'placed' then
    update public.order_items set status = 'placed' where order_id = v_order.id;
    perform private.notify(v_user, 'order_placed', 'Order placed', 'Order ' || v_order.order_number || ' is confirmed.',
                           jsonb_build_object('order_id', v_order.id));
  end if;

  delete from public.cart_items where user_id = v_user;

  return query select v_order.id, v_order.order_number, v_order.total_paise, v_order.status;
end $$;

-- Customer cancels the whole order.
create or replace function public.cancel_order(p_order_id bigint, p_reason text default 'Cancelled by customer')
returns void language plpgsql security definer set search_path = public as $$
declare o record; it record;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or (o.user_id is distinct from auth.uid() and not private.is_staff('support')) then raise exception 'Order not found'; end if;
  if o.status = 'pending_payment' then
    perform private.void_unpaid_order(p_order_id, p_reason);
    return;
  end if;
  if o.status <> 'placed' then raise exception 'This order can no longer be cancelled'; end if;
  if exists (select 1 from public.order_items where order_id = p_order_id and status not in ('placed','packed','cancelled')) then
    raise exception 'Some items have already shipped. Cancel the remaining items one by one.';
  end if;
  for it in select id from public.order_items where order_id = p_order_id and status in ('placed','packed') loop
    perform public.cancel_order_item(it.id, p_reason);
  end loop;
end $$;

-- Customer (or support) cancels one item before it ships.
create or replace function public.cancel_order_item(p_item_id bigint, p_reason text default 'Cancelled by customer')
returns void language plpgsql security definer set search_path = public as $$
declare it record; o record;
begin
  select * into it from public.order_items where id = p_item_id for update;
  if not found then raise exception 'Item not found'; end if;
  select * into o from public.orders where id = it.order_id for update;
  if o.user_id is distinct from auth.uid() and not private.is_staff('support') then raise exception 'Item not found'; end if;
  if o.status = 'pending_payment' then raise exception 'Payment is pending for this order. Cancel the whole order instead.'; end if;
  if it.status not in ('placed','packed') then
    raise exception 'This item can no longer be cancelled (it is %)', replace(it.status::text, '_', ' ');
  end if;

  perform private.release_stock(it.variant_id, it.warehouse_id, it.quantity);
  update public.order_items set status = 'cancelled', shipment_id = null where id = p_item_id;

  if o.payment_method <> 'cod' then
    perform private.issue_refund(o.id, it.id, null, it.line_total_paise,
            case when o.payment_method = 'store_credit' then 'store_credit'::public.refund_method_t else 'original_payment' end);
  end if;

  -- everything cancelled -> cancel the order, refund the fees, give back the coupon
  if not exists (select 1 from public.order_items where order_id = o.id and status <> 'cancelled') then
    update public.orders set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason where id = o.id;
    if o.payment_method <> 'cod' then
      perform private.issue_refund(o.id, null, null, o.shipping_fee_paise + o.cod_fee_paise + o.platform_fee_paise,
              case when o.payment_method = 'store_credit' then 'store_credit'::public.refund_method_t else 'original_payment' end);
    end if;
    if o.coupon_id is not null then
      update public.coupons set used_count = greatest(used_count - 1, 0) where id = o.coupon_id;
      delete from public.coupon_redemptions where order_id = o.id;
    end if;
  end if;
end $$;

-- Customer asks to return or exchange a delivered item.
create or replace function public.request_return(
  p_order_item_id bigint,
  p_reason public.return_reason_t,
  p_type public.return_type_t default 'return',
  p_quantity integer default null,
  p_comment text default null,
  p_image_keys text[] default '{}',
  p_exchange_variant_id bigint default null,
  p_refund_method public.refund_method_t default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare it record; o record; v_method public.refund_method_t; v_qty integer; v_id bigint; v_new record;
begin
  select * into it from public.order_items where id = p_order_item_id for update;
  if not found then raise exception 'Item not found'; end if;
  select * into o from public.orders where id = it.order_id;
  if o.user_id is distinct from auth.uid() then raise exception 'Item not found'; end if;
  if it.status <> 'delivered' then raise exception 'Only delivered items can be returned'; end if;
  if not it.is_returnable then raise exception 'This item is not returnable'; end if;
  if it.return_window_ends_at is null or now() > it.return_window_ends_at then raise exception 'The return window for this item has closed'; end if;
  if p_reason in ('damaged','wrong_item') and coalesce(cardinality(p_image_keys), 0) = 0 then
    raise exception 'Please add a photo of the item';
  end if;

  v_qty := coalesce(p_quantity, it.quantity);
  if v_qty < 1 or v_qty > it.quantity then raise exception 'Quantity must be between 1 and %', it.quantity; end if;

  if p_type = 'exchange' then
    select v.id, v.product_id, v.is_active, coalesce((select sum(available) from public.inventory where variant_id = v.id), 0) as available
      into v_new from public.product_variants v where v.id = p_exchange_variant_id;
    if not found or v_new.product_id <> it.product_id or v_new.id = it.variant_id or not v_new.is_active then
      raise exception 'Exchange is only possible for another size of the same product';
    end if;
    if v_new.available < v_qty then raise exception 'That size is out of stock. Choose a return instead.'; end if;
  else
    v_method := coalesce(p_refund_method, case when o.payment_method = 'cod' then 'store_credit'::public.refund_method_t
                                               when o.payment_method = 'store_credit' then 'store_credit'::public.refund_method_t
                                               else 'original_payment'::public.refund_method_t end);
    if v_method = 'original_payment' and o.payment_method in ('cod','store_credit') then
      raise exception 'This order was not paid online. Choose store credit or bank transfer.';
    end if;
  end if;

  insert into public.returns (order_item_id, user_id, type, quantity, reason, comment, image_keys,
                              exchange_variant_id, pickup_address, refund_method)
  values (it.id, o.user_id, p_type, v_qty, p_reason, p_comment, coalesce(p_image_keys, '{}'),
          case when p_type = 'exchange' then p_exchange_variant_id end, o.shipping_address, v_method)
  returning id into v_id;
  update public.order_items set status = 'return_requested' where id = it.id;
  perform private.notify(o.user_id, 'return_update', 'Return requested',
          'We will schedule a pickup soon.', jsonb_build_object('return_id', v_id, 'order_id', o.id));
  return v_id;
end $$;

-- Stock per size for the product page (capped at 10 so competitors can't read your exact stock).
create or replace function public.get_variant_stock(p_product_id bigint)
returns table (variant_id bigint, size_id smallint, size_label text, sku text, available integer, price_paise integer, mrp_paise integer)
language sql stable security definer set search_path = public as $$
  select v.id, s.id, s.label, v.sku,
         least(coalesce((select sum(i.available) from public.inventory i
                           join public.warehouses w on w.id = i.warehouse_id and w.is_active
                          where i.variant_id = v.id), 0), 10)::int,
         coalesce(v.price_paise_override, p.price_paise), coalesce(v.mrp_paise_override, p.mrp_paise)
    from public.product_variants v
    join public.products p on p.id = v.product_id and (p.status = 'active' or private.is_staff())
    join public.sizes s on s.id = v.size_id
   where v.product_id = p_product_id and v.is_active
   order by s.sort_order
$$;

-- =====================================================================
--  SEARCH, LISTING & FILTERS
--  p is JSON, e.g. {"category_ids":[4],"gender":"men","brand_ids":[1,2],"color_families":["Blue"],
--  "size_ids":[3],"price_min":49900,"price_max":149900,"discount_min":30,
--  "attributes":{"fabric":["Cotton"],"fit":["Slim Fit"]},"q":"blue shirt","sort":"price_asc","limit":20,"offset":0}
--  sort: popularity (default) | price_asc | price_desc | discount | newest | rating   (relevance when q is given)
-- =====================================================================

-- Turns the JSON filter into ready-to-use arrays ONCE (category ids expanded to all sub-categories,
-- color families to color ids, search text to a tsquery). Every product row is then checked with cheap comparisons.
create or replace function private.parse_filter(
  p jsonb,
  out cats integer[], out gender public.gender_t, out brands integer[], out color_ids smallint[], out sizes smallint[],
  out price_min integer, out price_max integer, out disc_min integer, out tsq tsquery, out attrs jsonb,
  out coll bigint[], out include_oos boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  p := coalesce(p, '{}'::jsonb);
  if jsonb_typeof(p -> 'category_ids') = 'array' then
    cats := array(select c.id from public.categories c
                   where c.path_ids && array(select jsonb_array_elements_text(p -> 'category_ids')::int));
  end if;
  gender := nullif(p ->> 'gender', '')::public.gender_t;
  if jsonb_typeof(p -> 'brand_ids') = 'array' then brands := array(select jsonb_array_elements_text(p -> 'brand_ids')::int); end if;
  if jsonb_typeof(p -> 'color_families') = 'array' then
    color_ids := array(select co.id from public.colors co where co.family = any (array(select jsonb_array_elements_text(p -> 'color_families'))));
  end if;
  if jsonb_typeof(p -> 'size_ids') = 'array' then sizes := array(select jsonb_array_elements_text(p -> 'size_ids')::smallint); end if;
  price_min := (p ->> 'price_min')::int;
  price_max := (p ->> 'price_max')::int;
  disc_min  := (p ->> 'discount_min')::int;
  if nullif(btrim(p ->> 'q'), '') is not null then
    tsq := websearch_to_tsquery('english', p ->> 'q');
    if numnode(tsq) = 0 then tsq := null; end if;      -- only stop-words like "the"
  end if;
  if jsonb_typeof(p -> 'attributes') = 'object' and p -> 'attributes' <> '{}'::jsonb then attrs := p -> 'attributes'; end if;
  if p ->> 'collection_id' is not null then
    coll := array(select cp.product_id from public.collection_products cp where cp.collection_id = (p ->> 'collection_id')::int);
  end if;
  include_oos := coalesce((p ->> 'include_out_of_stock')::boolean, false);
end $$;

-- Listing / search results page (one card per row) with the total count for "1,234 items".
create or replace function public.browse_products(p jsonb default '{}')
returns table (id bigint, slug text, title text, brand_name text, image_key text, price_paise integer, mrp_paise integer,
               discount_pct smallint, rating_avg numeric, rating_count integer, available_size_ids smallint[],
               in_stock boolean, total_count bigint)
language plpgsql stable set search_path = public as $$
#variable_conflict use_column
declare
  f record;
  v_sort text := coalesce(p ->> 'sort', case when nullif(btrim(p ->> 'q'), '') is not null then 'relevance' else 'popularity' end);
  v_limit integer := least(greatest(coalesce((p ->> 'limit')::int, 20), 1), 60);
  v_offset integer := greatest(coalesce((p ->> 'offset')::int, 0), 0);
begin
  select * into f from private.parse_filter(p);
  return query
  select pr.id, pr.slug, pr.title, b.name, pr.images[1], pr.price_paise, pr.mrp_paise, pr.discount_pct,
         pr.rating_avg, pr.rating_count, pr.available_size_ids, pr.in_stock, count(*) over ()
    from public.products pr
    join public.brands b on b.id = pr.brand_id
   where pr.status = 'active'
     and (f.cats is null or pr.category_id = any (f.cats))
     and (f.gender is null or pr.gender = f.gender or pr.gender = 'unisex')
     and (f.brands is null or pr.brand_id = any (f.brands))
     and (f.color_ids is null or pr.color_id = any (f.color_ids))
     and (f.sizes is null or pr.available_size_ids && f.sizes)
     and (f.price_min is null or pr.price_paise >= f.price_min)
     and (f.price_max is null or pr.price_paise <= f.price_max)
     and (f.disc_min is null or pr.discount_pct >= f.disc_min)
     and (f.include_oos or pr.in_stock)
     and (f.tsq is null or pr.search_vector @@ f.tsq)
     and (f.coll is null or pr.id = any (f.coll))
     and (f.attrs is null or not exists (
            select 1 from jsonb_each(f.attrs) a
             where not coalesce(pr.attributes ->> a.key = any (array(select jsonb_array_elements_text(a.value))), false)))
   order by
     pr.in_stock desc,
     case when v_sort = 'price_asc'  then pr.price_paise end asc,
     case when v_sort = 'price_desc' then pr.price_paise end desc,
     case when v_sort = 'discount'   then pr.discount_pct end desc,
     case when v_sort = 'newest'     then pr.published_at end desc,
     case when v_sort = 'rating'     then pr.rating_avg end desc,
     case when v_sort = 'relevance' and f.tsq is not null then ts_rank(pr.search_vector, f.tsq) end desc,
     pr.popularity desc, pr.id desc
   limit v_limit offset v_offset;
end $$;

-- Filter panel with counts, in ONE pass over the products.
-- Each row is tagged with which filters it passes; each facet counts rows passing all the OTHER filters
-- (so after picking a brand you still see every brand with its count — "disjunctive" facets, like Myntra).
create or replace function public.browse_facets(p jsonb default '{}')
returns jsonb language plpgsql stable set search_path = public as $$
declare f record; v jsonb;
begin
  select * into f from private.parse_filter(p);
  with base as materialized (
    select pr.brand_id, co.family, co.hex, pr.available_size_ids, pr.price_paise, pr.discount_pct, pr.attributes,
           (f.brands is null or pr.brand_id = any (f.brands))                                   as mb,
           (f.color_ids is null or pr.color_id = any (f.color_ids))                             as mc,
           (f.sizes is null or pr.available_size_ids && f.sizes)                                as ms,
           ((f.price_min is null or pr.price_paise >= f.price_min)
              and (f.price_max is null or pr.price_paise <= f.price_max))                        as mp,
           (f.disc_min is null or pr.discount_pct >= f.disc_min)                                as md,
           case when f.attrs is null then '{}'::text[]
                else array(select a.key from jsonb_each(f.attrs) a
                            where not coalesce(pr.attributes ->> a.key = any (array(select jsonb_array_elements_text(a.value))), false))
           end                                                                                  as failed   -- attribute filters this row fails
      from public.products pr
      join public.colors co on co.id = pr.color_id
     where pr.status = 'active'
       and (f.cats is null or pr.category_id = any (f.cats))
       and (f.gender is null or pr.gender = f.gender or pr.gender = 'unisex')
       and (f.include_oos or pr.in_stock)
       and (f.tsq is null or pr.search_vector @@ f.tsq)
       and (f.coll is null or pr.id = any (f.coll))
  )
  select jsonb_build_object(
    'total', (select count(*) from base where mb and mc and ms and mp and md and cardinality(failed) = 0),
    'brands', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'count', x.n) order by x.n desc, b.name), '[]')
                 from (select brand_id, count(*) n from base where mc and ms and mp and md and cardinality(failed) = 0 group by brand_id) x
                 join public.brands b on b.id = x.brand_id),
    'colors', (select coalesce(jsonb_agg(jsonb_build_object('family', x.family, 'hex', x.hex, 'count', x.n) order by x.n desc), '[]')
                 from (select family, min(hex) hex, count(*) n from base where mb and ms and mp and md and cardinality(failed) = 0 group by family) x),
    'sizes', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'label', s.label, 'count', x.n) order by s.system, s.sort_order), '[]')
                from (select u.size_id, count(*) n from base, unnest(base.available_size_ids) as u(size_id)
                       where mb and mc and mp and md and cardinality(failed) = 0 group by u.size_id) x
                join public.sizes s on s.id = x.size_id),
    'price', (select jsonb_build_object('min', min(price_paise), 'max', max(price_paise))
                from base where mb and mc and ms and md and cardinality(failed) = 0),
    'discounts', (select jsonb_agg(jsonb_build_object('min_pct', d.pct, 'count', d.n) order by d.pct)
                    from (select d.pct, count(*) filter (where b.discount_pct >= d.pct) n
                            from base b cross join (values (10),(20),(30),(40),(50),(60),(70)) d(pct)
                           where b.mb and b.mc and b.ms and b.mp and cardinality(b.failed) = 0
                           group by d.pct) d),
    'attributes', (select coalesce(jsonb_object_agg(ad.key, jsonb_build_object('label', ad.label, 'values', v.vals)), '{}')
                     from (select distinct on (key) key, label from public.attribute_definitions
                            where is_filterable order by key, category_id nulls first) ad
                     cross join lateral (
                       select jsonb_agg(jsonb_build_object('value', z.val, 'count', z.n) order by z.n desc, z.val) vals
                         from (select b.attributes ->> ad.key val, count(*) n
                                 from base b
                                where b.mb and b.mc and b.ms and b.mp and b.md
                                  and b.failed <@ array[ad.key]            -- ignore only this attribute's own filter
                                  and b.attributes ? ad.key
                                group by 1) z) v
                    where v.vals is not null))
  into v;
  return v;
end $$;

-- Search box suggestions as the user types ("rob" -> brand Roadster, category Robes...).
create or replace function public.search_suggestions(q text)
returns table (kind text, label text, ref text)
language sql stable set search_path = public as $$
  with t as (select replace(replace(btrim(q), '%', ''), '_', '') as term)
  (select 'brand', b.name, b.slug from public.brands b, t where b.is_active and length(t.term) >= 2 and b.name ilike t.term || '%' order by b.name limit 3)
  union all
  (select 'category', c.name, c.slug from public.categories c, t where c.is_active and length(t.term) >= 2 and c.name ilike '%' || t.term || '%' order by c.level desc, c.name limit 3)
  union all
  (select 'product', p.title, p.slug from public.products p, t where p.status = 'active' and length(t.term) >= 2 and p.title ilike '%' || t.term || '%' order by p.popularity desc limit 5)
$$;

-- =====================================================================
--  SERVER-SIDE FUNCTIONS (payment webhook, staff tools, scheduled jobs)
--  Called from a Supabase Edge Function with the service_role key, or by staff.
-- =====================================================================

-- Razorpay/Cashfree webhook -> this function. Safe to call many times with the same event.
create or replace function public.apply_payment_webhook(
  p_order_id bigint, p_provider text, p_provider_order_id text, p_provider_payment_id text,
  p_method public.payment_method_t, p_amount_paise integer, p_status public.payment_status_t, p_raw jsonb default null,
  p_error_code text default null, p_error_reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare o record; v_pay_id bigint;
begin
  if not private.is_service() then raise exception 'Only the payment server can call this'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order % not found', p_order_id; end if;

  insert into public.payments (order_id, provider, provider_order_id, provider_payment_id, method, amount_paise, status, raw, error_code, error_reason)
  values (p_order_id, p_provider, p_provider_order_id, p_provider_payment_id, p_method, p_amount_paise, p_status, p_raw, p_error_code, p_error_reason)
  on conflict (provider_payment_id) do update
     set status = excluded.status, raw = coalesce(excluded.raw, public.payments.raw),
         error_code = excluded.error_code, error_reason = excluded.error_reason, updated_at = now()
  returning id into v_pay_id;

  if p_status <> 'captured' then return 'recorded'; end if;   -- failed attempt: order stays open until expires_at so the user can retry

  if exists (select 1 from public.refunds where payment_id = v_pay_id) then return 'already_handled'; end if;

  if o.status = 'pending_payment' then
    if p_amount_paise <> o.total_paise then
      perform private.issue_refund(o.id, null, null, p_amount_paise, 'original_payment');
      return 'amount_mismatch_refunded';
    end if;
    update public.orders set status = 'placed', placed_at = now(), expires_at = null, payment_method = p_method where id = o.id;
    update public.order_items set status = 'placed' where order_id = o.id and status = 'pending_payment';
    perform private.notify(o.user_id, 'order_placed', 'Order placed', 'Order ' || o.order_number || ' is confirmed.',
                           jsonb_build_object('order_id', o.id));
    return 'placed';
  elsif o.status = 'cancelled' then
    -- paid after the payment window closed: stock was already released, so refund automatically
    perform private.issue_refund(o.id, null, null, p_amount_paise, 'original_payment');
    return 'late_payment_refunded';
  end if;
  return 'already_placed';
end $$;

-- Edge Function reports back after calling the gateway's refund API.
create or replace function public.mark_refund(p_refund_id bigint, p_status public.refund_status_t, p_provider_refund_id text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_pay bigint;
begin
  if not (private.is_service() or private.is_staff('support')) then raise exception 'Not allowed'; end if;
  update public.refunds set status = p_status, provider_refund_id = coalesce(p_provider_refund_id, provider_refund_id),
         processed_at = case when p_status = 'processed' then now() end
   where id = p_refund_id returning payment_id into v_pay;
  if p_status = 'processed' and v_pay is not null then
    update public.payments p
       set status = case when (select sum(amount_paise) from public.refunds r where r.payment_id = p.id and r.status = 'processed') >= p.amount_paise
                         then 'refunded'::public.payment_status_t else 'partially_refunded' end
     where p.id = v_pay;
  end if;
end $$;

-- Warehouse packs items into a parcel.
create or replace function public.create_shipment(p_order_id bigint, p_item_ids bigint[], p_courier text, p_awb text, p_tracking_url text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare o record; v_wh integer; v_cnt integer; v_id bigint; v_cod integer := 0;
begin
  if not (private.is_staff('warehouse') or private.is_service()) then raise exception 'Not allowed'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.status <> 'placed' then raise exception 'Order is not ready to ship (status %)', o.status; end if;
  select count(*), min(warehouse_id) into v_cnt, v_wh
    from public.order_items where order_id = p_order_id and id = any (p_item_ids) and status = 'placed' and shipment_id is null
   having count(distinct warehouse_id) = 1;
  if v_cnt is null or v_cnt <> cardinality(p_item_ids) then
    raise exception 'All items must belong to this order, be unshipped, and come from one warehouse';
  end if;
  if o.payment_method = 'cod' then
    select sum(line_total_paise) into v_cod from public.order_items where id = any (p_item_ids);
    if not exists (select 1 from public.shipments where order_id = p_order_id) then
      v_cod := v_cod + o.shipping_fee_paise + o.cod_fee_paise + o.platform_fee_paise;   -- fees collected with the first parcel
    end if;
  end if;
  insert into public.shipments (order_id, warehouse_id, courier, awb_number, tracking_url, cod_amount_paise)
  values (p_order_id, v_wh, p_courier, p_awb, p_tracking_url, v_cod) returning id into v_id;
  update public.order_items set shipment_id = v_id, status = 'packed' where id = any (p_item_ids);
  return v_id;
end $$;

-- Courier webhook / warehouse updates a parcel. Handles stock, return windows, COD cash and RTO.
create or replace function public.update_shipment_status(p_shipment_id bigint, p_status public.shipment_status_t, p_event jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare sh record; o record; it record; v_days smallint;
begin
  if not (private.is_staff('warehouse') or private.is_service()) then raise exception 'Not allowed'; end if;
  select * into sh from public.shipments where id = p_shipment_id for update;
  if not found then raise exception 'Shipment not found'; end if;
  select * into o from public.orders where id = sh.order_id;
  select return_window_days into v_days from public.store_settings where id;

  update public.shipments
     set status = p_status,
         tracking_events = tracking_events || jsonb_build_array(coalesce(p_event, jsonb_build_object('at', now(), 'status', p_status))),
         shipped_at = case when p_status = 'picked_up' and shipped_at is null then now() else shipped_at end,
         delivered_at = case when p_status = 'delivered' then now() else delivered_at end
   where id = p_shipment_id;

  if p_status = sh.status then return; end if;   -- just a new scan, nothing else changes

  if p_status = 'picked_up' then
    for it in select id from public.order_items where shipment_id = p_shipment_id and status = 'packed' loop
      perform private.commit_stock(it.id);
    end loop;
    update public.order_items set status = 'shipped' where shipment_id = p_shipment_id and status = 'packed';
    perform private.notify(o.user_id, 'order_shipped', 'Shipped', 'Your order ' || o.order_number || ' is on the way.',
                           jsonb_build_object('order_id', o.id));
  elsif p_status = 'out_for_delivery' then
    update public.order_items set status = 'out_for_delivery' where shipment_id = p_shipment_id and status = 'shipped';
  elsif p_status = 'delivered' then
    update public.order_items
       set status = 'delivered', delivered_at = now(),
           return_window_ends_at = case when is_returnable then now() + make_interval(days => v_days) end
     where shipment_id = p_shipment_id and status in ('shipped','out_for_delivery');
    if sh.cod_amount_paise > 0 then
      insert into public.payments (order_id, provider, provider_payment_id, method, amount_paise, status)
      values (o.id, 'courier_cod', 'COD-' || coalesce(sh.awb_number, sh.id::text), 'cod', sh.cod_amount_paise, 'captured')
      on conflict (provider_payment_id) do nothing;
    end if;
    perform private.notify(o.user_id, 'order_delivered', 'Delivered', 'Your order ' || o.order_number || ' was delivered.',
                           jsonb_build_object('order_id', o.id));
  elsif p_status = 'rto_delivered' then
    -- parcel came back to the warehouse (customer refused / unreachable)
    for it in select id, quantity, line_total_paise from public.order_items
               where shipment_id = p_shipment_id and status in ('shipped','out_for_delivery') loop
      perform private.restock(it.id, it.quantity, 'rto_restock');
      if o.payment_method <> 'cod' then
        perform private.issue_refund(o.id, it.id, null, it.line_total_paise,
                case when o.payment_method = 'store_credit' then 'store_credit'::public.refund_method_t else 'original_payment' end);
      end if;
    end loop;
    update public.order_items set status = 'rto' where shipment_id = p_shipment_id and status in ('shipped','out_for_delivery');
  end if;
end $$;

-- Support / warehouse moves a return forward. Completing it restocks and refunds, or ships the new size.
create or replace function public.update_return(p_return_id bigint, p_status public.return_status_t, p_notes text default null, p_pickup_awb text default null)
returns text language plpgsql security definer set search_path = public as $$
declare rt record; it record; o record; v_amount integer; v_wh integer; v_new_order bigint; v_new record; v_result text := p_status::text;
begin
  select * into rt from public.returns where id = p_return_id for update;
  if not found then raise exception 'Return not found'; end if;

  -- customers may only cancel their own return before pickup
  if not (private.is_staff('support') or private.is_staff('warehouse') or private.is_service()) then
    if rt.user_id is distinct from auth.uid() or p_status <> 'cancelled' then raise exception 'Not allowed'; end if;
  end if;

  if not (
       (rt.status = 'requested'        and p_status in ('approved','rejected','cancelled'))
    or (rt.status = 'approved'         and p_status in ('pickup_scheduled','cancelled'))
    or (rt.status = 'pickup_scheduled' and p_status in ('picked_up','cancelled'))
    or (rt.status = 'picked_up'        and p_status = 'received')
    or (rt.status = 'received'         and p_status in ('refunded','exchanged','qc_failed'))) then
    raise exception 'Cannot move a return from % to %', rt.status, p_status;
  end if;
  if p_status = 'refunded' and rt.type <> 'return' then raise exception 'Use exchanged for exchange requests'; end if;
  if p_status = 'exchanged' and rt.type <> 'exchange' then raise exception 'Use refunded for return requests'; end if;

  select * into it from public.order_items where id = rt.order_item_id for update;
  select * into o from public.orders where id = it.order_id;

  if p_status in ('rejected','cancelled','qc_failed') then
    update public.order_items set status = 'delivered' where id = it.id;
  elsif p_status in ('refunded','exchanged') then
    perform private.restock(it.id, rt.quantity, 'return_restock');
    if p_status = 'exchanged' then
      v_wh := private.reserve_stock(rt.exchange_variant_id, rt.quantity);
      if v_wh is null then
        p_status := 'refunded';    -- new size sold out meanwhile: refund instead
        rt.refund_method := case when o.payment_method in ('cod','store_credit') then 'store_credit'::public.refund_method_t else 'original_payment' end;
        v_result := 'size_sold_out_refunded';
      else
        select v.sku, p.title, b.name as brand_name, s.label as size_label, co.name as color_name, p.images[1] as image_key, p.hsn_code, v.product_id
          into v_new
          from public.product_variants v join public.products p on p.id = v.product_id
          join public.brands b on b.id = p.brand_id join public.sizes s on s.id = v.size_id join public.colors co on co.id = p.color_id
         where v.id = rt.exchange_variant_id;
        insert into public.orders (user_id, order_type, parent_order_id, status, payment_method, shipping_address, shipping_pincode, item_count, placed_at)
        values (o.user_id, 'exchange', o.id, 'placed', o.payment_method, rt.pickup_address, rt.pickup_address ->> 'pincode', rt.quantity, now())
        returning id into v_new_order;
        insert into public.order_items (order_id, variant_id, product_id, warehouse_id, sku, title, brand_name, size_label, color_name,
                                        image_key, hsn_code, quantity, unit_mrp_paise, unit_price_paise, status, is_returnable)
        values (v_new_order, rt.exchange_variant_id, v_new.product_id, v_wh, v_new.sku, v_new.title, v_new.brand_name, v_new.size_label,
                v_new.color_name, v_new.image_key, v_new.hsn_code, rt.quantity, it.unit_mrp_paise, 0, 'placed', false);
        update public.returns set exchange_order_id = v_new_order where id = rt.id;
        update public.order_items set status = 'exchanged' where id = it.id;
        perform private.notify(o.user_id, 'return_update', 'Exchange confirmed', 'Your new size is being packed.',
                               jsonb_build_object('order_id', v_new_order));
      end if;
    end if;
    if p_status = 'refunded' then
      v_amount := round(it.line_total_paise::numeric * rt.quantity / it.quantity);
      if v_amount > 0 then perform private.issue_refund(o.id, it.id, rt.id, v_amount, rt.refund_method); end if;
      update public.returns set refund_amount_paise = v_amount, refund_method = rt.refund_method where id = rt.id;
      update public.order_items set status = 'returned' where id = it.id;
    end if;
  end if;

  update public.returns set status = p_status, qc_notes = coalesce(p_notes, qc_notes), pickup_awb = coalesce(p_pickup_awb, pickup_awb)
   where id = rt.id;
  return v_result;
end $$;

-- ---------------------------------------------------------------------
-- Scheduled jobs (Supabase: Database -> Cron, uses pg_cron)
--   every 5 min : select public.expire_unpaid_orders();
--   nightly     : select public.close_completed_orders(); select public.refresh_popularity();
-- ---------------------------------------------------------------------
create or replace function public.expire_unpaid_orders() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  if not (private.is_service() or private.is_staff('admin') or session_user in ('postgres','supabase_admin')) then raise exception 'Not allowed'; end if;
  for r in select id from public.orders where status = 'pending_payment' and expires_at < now() for update skip locked loop
    perform private.void_unpaid_order(r.id, 'Payment not completed in time');
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.close_completed_orders() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not (private.is_service() or private.is_staff('admin') or session_user in ('postgres','supabase_admin')) then raise exception 'Not allowed'; end if;
  update public.orders o set status = 'completed'
   where o.status = 'placed'
     and not exists (select 1 from public.order_items i where i.order_id = o.id
                      and (i.status not in ('delivered','cancelled','returned','exchanged','rto')
                           or (i.status = 'delivered' and i.return_window_ends_at > now())));
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.refresh_popularity() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not (private.is_service() or private.is_staff('admin') or session_user in ('postgres','supabase_admin')) then raise exception 'Not allowed'; end if;
  with sold as (
    select product_id, sum(quantity)::int as units from public.order_items
     where created_at > now() - interval '30 days' and status not in ('pending_payment','cancelled')
     group by product_id)
  update public.products p set popularity = coalesce(s.units, 0)
    from public.products p2 left join sold s on s.product_id = p2.id
   where p.id = p2.id and p.popularity is distinct from coalesce(s.units, 0);
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Descriptions (shown in the Supabase dashboard and in the Obsidian notes)
-- ---------------------------------------------------------------------
comment on function public.cart_summary(text, public.payment_method_t) is 'Bag screen "Price Details": MRP, discount, coupon (with a friendly error if it does not apply), shipping/COD/platform fees and total. Read-only, safe to call on every bag change.';
comment on function public.my_store_credit() is 'Current store-credit balance of the signed-in user, in paise.';
comment on function public.place_order(bigint, public.payment_method_t, text, boolean) is 'CHECKOUT. Re-prices the bag on the server, checks pincode/COD, reserves stock (no overselling), applies coupon and store credit, freezes the address and product details, empties the bag. Prepaid orders wait for payment; COD and fully store-credit orders are placed at once.';
comment on function public.cancel_order(bigint, text) is 'Customer cancels a whole order (unpaid: voided; placed: every unshipped item cancelled and refunded).';
comment on function public.cancel_order_item(bigint, text) is 'Cancel one item before it ships: stock released, refund created (gateway first, store credit for the rest). Last item cancelled = order cancelled, fees refunded, coupon given back.';
comment on function public.request_return(bigint, public.return_reason_t, public.return_type_t, integer, text, text[], bigint, public.refund_method_t) is 'Customer requests a return or a size exchange for a delivered item inside the return window. Photos required for damaged/wrong item.';
comment on function public.get_variant_stock(bigint) is 'Product page size selector: each size with price and stock (capped at 10, so exact stock stays private).';
comment on function public.browse_products(jsonb) is 'Listing and search results (one card per product) with filters, sort and paging. Returns total_count for "1,234 items".';
comment on function public.browse_facets(jsonb) is 'Filter panel: counts for brands, colors, sizes, price range, discount and every attribute, in one pass. Each facet ignores its own selection so users can pick several values.';
comment on function public.search_suggestions(text) is 'Search-box suggestions while typing: matching brands, categories and product titles.';
comment on function public.apply_payment_webhook(bigint, text, text, text, public.payment_method_t, integer, public.payment_status_t, jsonb, text, text) is 'SERVER ONLY. Called by the payment Edge Function after verifying the gateway signature. Records the attempt; on capture places the order. Handles repeats, wrong amounts and payments that arrive after the order expired (auto-refund).';
comment on function public.mark_refund(bigint, public.refund_status_t, text) is 'SERVER/SUPPORT. Records the gateway result of a refund and updates the payment to refunded / partially_refunded.';
comment on function public.create_shipment(bigint, bigint[], text, text, text) is 'WAREHOUSE. Packs items (same order, same warehouse) into a parcel with courier + AWB, and works out the COD cash to collect.';
comment on function public.update_shipment_status(bigint, public.shipment_status_t, jsonb) is 'WAREHOUSE/COURIER WEBHOOK. Adds a tracking scan and moves items: picked_up removes stock from the shelf, delivered starts the return window and records COD cash, rto_delivered restocks and refunds prepaid items.';
comment on function public.update_return(bigint, public.return_status_t, text, text) is 'SUPPORT/WAREHOUSE moves a return through its steps (customers can only cancel). Completing it restocks and refunds, or reserves the new size and creates a ₹0 exchange order (refunds instead if that size sold out).';
comment on function public.expire_unpaid_orders() is 'JOB (every 5 min). Cancels prepaid orders not paid within the payment window: stock, coupon use and store credit are given back.';
comment on function public.close_completed_orders() is 'JOB (nightly). Marks orders completed once every item is final and return windows have closed.';
comment on function public.refresh_popularity() is 'JOB (nightly). Sets products.popularity = units sold in the last 30 days (default "Popular" sort).';
comment on function private.price_cart(uuid, text, public.payment_method_t, boolean) is 'Single source of truth for bag pricing, used by cart_summary and place_order.';
comment on function private.reserve_stock(bigint, integer) is 'Locks the stock row and reserves pieces from the warehouse with most availability. Returns NULL when not enough stock.';
comment on function private.release_stock(bigint, integer, integer) is 'Gives reserved pieces back (cancel / payment timeout).';
comment on function private.commit_stock(bigint) is 'Item left the warehouse: on_hand and reserved both go down; history row written.';
comment on function private.restock(bigint, integer, public.stock_reason_t) is 'Pieces back on the shelf (return passed QC, RTO).';
comment on function private.issue_refund(bigint, bigint, bigint, integer, public.refund_method_t) is 'Creates refunds: to the gateway up to what is still refundable, the rest as store credit (instant).';
comment on function private.void_unpaid_order(bigint, text) is 'Cancels an unpaid order and returns stock, coupon use and store credit.';
comment on function private.parse_filter(jsonb) is 'Converts the listing filter JSON into arrays once (sub-categories, color ids, tsquery).';
comment on function private.gst_rate(integer, text) is 'GST % for a per-piece sale value, from tax_slabs.';
comment on function private.is_staff(public.staff_role_t) is 'TRUE if the signed-in user is staff with that role (admin passes every role). Used by security rules.';
comment on function private.refresh_product_stock(bigint) is 'Recomputes products.available_size_ids and in_stock from inventory.';
comment on function private.refresh_product_rating(bigint) is 'Recomputes products.rating_avg and rating_count from published reviews.';
comment on function private.notify(uuid, text, text, text, jsonb) is 'Adds a row to the user''s notification inbox.';

-- =====================================================================
--  Part 3 of 3: Row Level Security (who can see / change which rows)
--  Supabase exposes every public table to the app, so EVERY table has RLS on.
--  Rule of thumb: customers read catalog + their own rows; money/stock changes
--  only happen inside the functions in Part 2 (they run as the owner).
-- =====================================================================

grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.is_staff(public.staff_role_t) to anon, authenticated, service_role;

-- turn RLS on for every table in public
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- Catalog: everyone can read, catalog staff can write ----------
create policy "read: everyone" on public.brands for select using (is_active or (select private.is_staff()));
create policy "write: catalog staff" on public.brands for all to authenticated using ((select private.is_staff('catalog'))) with check ((select private.is_staff('catalog')));

create policy "read: everyone" on public.categories for select using (is_active or (select private.is_staff()));
create policy "write: catalog staff" on public.categories for all to authenticated using ((select private.is_staff('catalog'))) with check ((select private.is_staff('catalog')));

create policy "read: everyone" on public.size_charts for select using (true);
create policy "write: catalog staff" on public.size_charts for all to authenticated using ((select private.is_staff('catalog'))) with check ((select private.is_staff('catalog')));

create policy "read: everyone" on public.colors for select using (true);
create policy "write: catalog staff" on public.colors for all to authenticated using ((select private.is_staff('catalog'))) with check ((select private.is_staff('catalog')));

create policy "read: everyone" on public.sizes for select using (true);
create policy "write: catalog staff" on public.sizes for all to authenticated using ((select private.is_staff('catalog'))) with check ((select private.is_staff('catalog')));

create policy "read: everyone" on public.attribute_definitions for select using (true);
create policy "write: catalog staff" on public.attribute_definitions for all to authenticated using ((select private.is_staff('catalog'))) with check ((select private.is_staff('catalog')));

create policy "read: live products" on public.products for select using (status = 'active' or (select private.is_staff()));
create policy "write: catalog staff" on public.products for all to authenticated using ((select private.is_staff('catalog'))) with check ((select private.is_staff('catalog')));

create policy "read: everyone" on public.product_variants for select using (true);
create policy "write: catalog staff" on public.product_variants for all to authenticated using ((select private.is_staff('catalog'))) with check ((select private.is_staff('catalog')));

create policy "read: everyone" on public.collections for select
  using ((is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())) or (select private.is_staff()));
create policy "write: catalog staff" on public.collections for all to authenticated using ((select private.is_staff('catalog'))) with check ((select private.is_staff('catalog')));

create policy "read: everyone" on public.collection_products for select using (true);
create policy "write: catalog staff" on public.collection_products for all to authenticated using ((select private.is_staff('catalog'))) with check ((select private.is_staff('catalog')));

create policy "read: everyone" on public.home_banners for select
  using ((is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())) or (select private.is_staff()));
create policy "write: catalog staff" on public.home_banners for all to authenticated using ((select private.is_staff('catalog'))) with check ((select private.is_staff('catalog')));

create policy "read: everyone" on public.serviceable_pincodes for select using (true);
create policy "write: warehouse staff" on public.serviceable_pincodes for all to authenticated using ((select private.is_staff('warehouse'))) with check ((select private.is_staff('warehouse')));

create policy "read: everyone" on public.store_settings for select using (true);
create policy "write: admin" on public.store_settings for all to authenticated using ((select private.is_staff('admin'))) with check ((select private.is_staff('admin')));

create policy "read: everyone" on public.tax_slabs for select using (true);
create policy "write: admin" on public.tax_slabs for all to authenticated using ((select private.is_staff('admin'))) with check ((select private.is_staff('admin')));

create policy "read: public live coupons" on public.coupons for select
  using ((is_public and is_active and starts_at <= now() and (ends_at is null or ends_at > now())) or (select private.is_staff()));
create policy "write: catalog staff" on public.coupons for all to authenticated using ((select private.is_staff('catalog'))) with check ((select private.is_staff('catalog')));

-- ---------- Stock: staff only (shoppers use get_variant_stock()) ----------
create policy "warehouse staff" on public.warehouses for all to authenticated using ((select private.is_staff('warehouse'))) with check ((select private.is_staff('warehouse')));
create policy "warehouse staff" on public.inventory for all to authenticated using ((select private.is_staff('warehouse'))) with check ((select private.is_staff('warehouse')));
create policy "warehouse staff" on public.inventory_movements for all to authenticated using ((select private.is_staff('warehouse'))) with check ((select private.is_staff('warehouse')));

-- ---------- The customer's own rows ----------
create policy "own profile: read" on public.profiles for select to authenticated using (id = (select auth.uid()) or (select private.is_staff('support')));
create policy "own profile: update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own rows" on public.addresses      for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.wishlist_items for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.cart_items     for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.user_devices   for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "support reads" on public.addresses for select to authenticated using ((select private.is_staff('support')));

create policy "own: read" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "own: mark read" on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own staff row" on public.staff for select to authenticated using (user_id = (select auth.uid()) or (select private.is_staff('admin')));
create policy "admin manages staff" on public.staff for all to authenticated using ((select private.is_staff('admin'))) with check ((select private.is_staff('admin')));

-- ---------- Orders & money: customers READ their own; only functions WRITE ----------
create policy "own: read" on public.orders for select to authenticated using (user_id = (select auth.uid()) or (select private.is_staff('support')) or (select private.is_staff('warehouse')));
create policy "own: read" on public.order_items for select to authenticated
  using (order_id in (select id from public.orders where user_id = (select auth.uid())) or (select private.is_staff('support')) or (select private.is_staff('warehouse')));
create policy "own: read" on public.order_status_history for select to authenticated
  using (order_id in (select id from public.orders where user_id = (select auth.uid())) or (select private.is_staff('support')));
create policy "own: read" on public.shipments for select to authenticated
  using (order_id in (select id from public.orders where user_id = (select auth.uid())) or (select private.is_staff('support')) or (select private.is_staff('warehouse')));
create policy "own: read" on public.payments for select to authenticated
  using (order_id in (select id from public.orders where user_id = (select auth.uid())) or (select private.is_staff('support')));
create policy "own: read" on public.refunds for select to authenticated
  using (order_id in (select id from public.orders where user_id = (select auth.uid())) or (select private.is_staff('support')));
create policy "own: read" on public.returns for select to authenticated using (user_id = (select auth.uid()) or (select private.is_staff('support')) or (select private.is_staff('warehouse')));
create policy "own: read" on public.wallet_transactions for select to authenticated using (user_id = (select auth.uid()) or (select private.is_staff('support')));
create policy "own: read" on public.coupon_redemptions for select to authenticated using (user_id = (select auth.uid()) or (select private.is_staff('support')));
create policy "support: shipping label/tracking edits" on public.shipments for update to authenticated using ((select private.is_staff('warehouse'))) with check ((select private.is_staff('warehouse')));

-- ---------- Reviews: anyone reads published; only verified buyers write ----------
create policy "read: published or own" on public.reviews for select using (status = 'published' or user_id = (select auth.uid()) or (select private.is_staff('support')));
create policy "write: verified buyer" on public.reviews for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and order_item_id in (
      select oi.id from public.order_items oi join public.orders o on o.id = oi.order_id
       where o.user_id = (select auth.uid()) and oi.product_id = reviews.product_id
         and oi.status in ('delivered','returned','exchanged')));
create policy "edit: own" on public.reviews for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete: own" on public.reviews for delete to authenticated using (user_id = (select auth.uid()));
create policy "moderate: support" on public.reviews for update to authenticated using ((select private.is_staff('support'))) with check ((select private.is_staff('support')));

-- ---------- Column-level limits (RLS picks rows; these pick columns) ----------
revoke insert, update on public.reviews from anon, authenticated;
grant insert (product_id, user_id, order_item_id, rating, title, body, fit_feedback, image_keys) on public.reviews to authenticated;
grant update (rating, title, body, fit_feedback, image_keys) on public.reviews to authenticated;
-- support moderates through the service role or the dashboard

revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke insert, update on public.profiles from anon, authenticated;
grant update (full_name, phone, gender, date_of_birth, avatar_key, marketing_opt_in) on public.profiles to authenticated;

-- ---------- Function access ----------
-- Customers: cart_summary, my_store_credit, place_order, cancel_order, cancel_order_item, request_return,
--            get_variant_stock, browse_products, browse_facets, search_suggestions, update_return (cancel only)
revoke execute on function public.place_order(bigint, public.payment_method_t, text, boolean) from public, anon;
grant  execute on function public.place_order(bigint, public.payment_method_t, text, boolean) to authenticated, service_role;
revoke execute on function public.cart_summary(text, public.payment_method_t) from public, anon;
grant  execute on function public.cart_summary(text, public.payment_method_t) to authenticated, service_role;
revoke execute on function public.request_return(bigint, public.return_reason_t, public.return_type_t, integer, text, text[], bigint, public.refund_method_t) from public, anon;
grant  execute on function public.request_return(bigint, public.return_reason_t, public.return_type_t, integer, text, text[], bigint, public.refund_method_t) to authenticated, service_role;
-- Server only (Edge Functions with the service_role key, or cron)
revoke execute on function public.apply_payment_webhook(bigint, text, text, text, public.payment_method_t, integer, public.payment_status_t, jsonb, text, text) from public, anon, authenticated;
grant  execute on function public.apply_payment_webhook(bigint, text, text, text, public.payment_method_t, integer, public.payment_status_t, jsonb, text, text) to service_role;
revoke execute on function public.expire_unpaid_orders()   from public, anon, authenticated;
revoke execute on function public.close_completed_orders() from public, anon, authenticated;
revoke execute on function public.refresh_popularity()     from public, anon, authenticated;
grant  execute on function public.expire_unpaid_orders(), public.close_completed_orders(), public.refresh_popularity() to service_role;
-- Staff tools (functions also check the staff role inside)
revoke execute on function public.create_shipment(bigint, bigint[], text, text, text) from public, anon;
grant  execute on function public.create_shipment(bigint, bigint[], text, text, text) to authenticated, service_role;
revoke execute on function public.update_shipment_status(bigint, public.shipment_status_t, jsonb) from public, anon;
grant  execute on function public.update_shipment_status(bigint, public.shipment_status_t, jsonb) to authenticated, service_role;
revoke execute on function public.mark_refund(bigint, public.refund_status_t, text) from public, anon;
grant  execute on function public.mark_refund(bigint, public.refund_status_t, text) to authenticated, service_role;
revoke execute on function public.update_return(bigint, public.return_status_t, text, text) from public, anon;
grant  execute on function public.update_return(bigint, public.return_status_t, text, text) to authenticated, service_role;
-- Internal helpers are in the private schema: not reachable through the API at all.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_staff(public.staff_role_t) to anon, authenticated, service_role;
grant execute on function private.parse_filter(jsonb) to anon, authenticated, service_role;   -- used by browse_products / browse_facets


-- =====================================================================
--  DUSKEO DATA (replaces the vault's sample seed.sql)
-- =====================================================================
comment on table public.brands is 'Clothing brands you sell. Only Duskeo for now (id 0); ids start at 0. products.brand_id defaults to it.';
comment on table public.user_devices is 'Push-notification tokens (Firebase Cloud Messaging is free) for each phone/browser a user is logged in on. Kept EMPTY for now: Duskeo is a website, there is no app sending tokens yet.';
comment on table public.wallet_transactions is 'Store credit ledger (like "Myntra Credit"). Never edit a balance: add a + or - row. Balance = SUM(amount_paise). Kept EMPTY for now: store credit is not offered yet.';

insert into public.store_settings (image_cdn_base_url, support_email)
values ('', 'duskeo.store@gmail.com')
on conflict (id) do nothing;
comment on column public.store_settings.image_cdn_base_url is 'Prefix added to every image key to build a full image URL. Empty for now: products.images holds full Supabase Storage URLs.';

insert into public.tax_slabs (hsn_prefix, min_unit_price_paise, max_unit_price_paise, rate, valid_from) values
  (null, 0,      250000, 5.00,  '2025-09-22'),   -- up to ₹2,500 per piece
  (null, 250001, null,   18.00, '2025-09-22');   -- above ₹2,500 per piece

insert into public.brands (name, slug, description)
values ('Duskeo', 'duskeo', 'Wear progress. Repeat.');   -- identity starts at 0, so this is id 0

insert into public.colors (name, family, hex) values ('Black', 'Black', '#111111');

insert into public.sizes (label, system, sort_order) values
  ('S', 'alpha', 1), ('M', 'alpha', 2), ('L', 'alpha', 3), ('XL', 'alpha', 4), ('XXL', 'alpha', 5);

insert into public.size_charts (name, brand_id, unit, measurements, how_to_measure)
values ('Duskeo Oversized Tees', 0, 'cm',
        '{"columns":["Chest","Shoulder","Length","Sleeve"],"rows":{"S":[106.7,50.8,69.9,21.6],"M":[111.8,53.3,71.1,22.9],"L":[116.8,55.9,72.4,24.1],"XL":[121.9,58.4,73.7,25.4],"XXL":[127.0,61.0,74.9,26.7]}}',
        'All measurements are in centimeters. Allow ±2.54 cm variation.');

insert into public.categories (name, slug, gender, sort_order) values ('Topwear', 'topwear', 'unisex', 1);
insert into public.categories (parent_id, name, slug, gender, sort_order, size_chart_id)
select c.id, 'Oversized T-Shirts', 'oversized-tshirts', 'unisex', 1, (select id from public.size_charts where name = 'Duskeo Oversized Tees')
from public.categories c where c.slug = 'topwear';

insert into public.attribute_definitions (key, label, category_id, allowed_values, sort_order) values
  ('theme',  'Theme',  null, '{Anime,Samurai,Mythic}', 1),
  ('fit',    'Fit',    null, null, 2),
  ('fabric', 'Fabric', null, null, 3);

-- Placeholder: update code/name/address/city/state/pincode to the real dispatch location.
insert into public.warehouses (code, name, city, state, pincode) values ('MAIN', 'Duskeo Warehouse', 'TBD', 'TBD', '000000');

-- ---------------------------------------------------------------------
-- Move the old products and stock into the new tables
-- ---------------------------------------------------------------------
insert into public.products (style_code, category_id, color_id, gender, title, slug, description, attributes, images,
                             care_instructions, hsn_code, mrp_paise, price_paise, tags, status, published_at, created_at)
select 'DSK-' || upper(o.slug),
       (select id from public.categories where slug = 'oversized-tshirts'),
       (select id from public.colors where name = 'Black'),
       'unisex', o.name, o.slug, o.description,
       jsonb_build_object('theme', o.theme)
         || coalesce((select jsonb_object_agg(lower(regexp_replace(btrim(s ->> 'label'), '[^A-Za-z]+', '_', 'g')), s ->> 'value')
                        from jsonb_array_elements(o.specs) s
                       where upper(s ->> 'label') <> 'COLOR'), '{}'::jsonb),
       array(select ph ->> 'src' from jsonb_array_elements(o.photos) ph),
       'Wash inside out with similar colors. Use cold water and a gentle cycle. Do not bleach. Avoid ironing directly over printed artwork. Dry in shade.',
       '6109',
       greatest(o.price, 1) * 100, greatest(o.price, 1) * 100,
       case when o.is_dummy then '{dummy}'::text[] else '{}'::text[] end,
       case when o.is_deleted then 'archived' else 'active' end::public.product_status_t,
       o.launched_at::timestamptz, o.created_at
from old_products o;

insert into public.product_variants (product_id, size_id, sku)
select p.id, s.id, p.style_code || '-BLK-' || s.label
from public.products p
cross join public.sizes s
where s.system = 'alpha';

insert into public.inventory (variant_id, warehouse_id, on_hand)
select v.id, (select id from public.warehouses where code = 'MAIN'), oi.quantity
from old_inventory oi
join old_products op on op.id = oi.product_id
join public.products p on p.slug = op.slug
join public.sizes s on s.label = oi.size and s.system = 'alpha'
join public.product_variants v on v.product_id = p.id and v.size_id = s.id;

insert into public.inventory_movements (variant_id, warehouse_id, delta, reason, note)
select variant_id, warehouse_id, on_hand, 'purchase', 'Opening stock (moved from the old inventory table)'
from public.inventory where on_hand > 0;

-- old admins -> staff (role admin)
insert into public.profiles (id, email)
select u.id, u.email from auth.users u
where u.id in (select user_id from old_admins)
on conflict (id) do nothing;
insert into public.staff (user_id, role)
select user_id, 'admin' from old_admins
on conflict (user_id) do nothing;

drop table old_products;
drop table old_inventory;
drop table old_admins;

-- =====================================================================
--  WEBSITE FUNCTIONS (keep the current site working on the new tables)
-- =====================================================================
-- Admin screen gate. Also used by the product-images storage policies from 001.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select private.is_staff('admin')
$$;
comment on function public.is_admin() is 'TRUE if the signed-in user is staff with role admin. Used by the #admin screen and the product-images bucket policies.';

-- Stock for every live product and size, in one call (shoppers see at most 10; staff see real on_hand).
create or replace function public.get_stock_levels()
returns table (product_title text, size_label text, quantity integer)
language sql stable security definer set search_path = public as $$
  select p.title, s.label,
         case when private.is_staff()
              then coalesce(sum(i.on_hand), 0)
              else least(coalesce(sum(i.available) filter (where w.is_active), 0), 10)
         end::int
    from public.products p
    join public.product_variants v on v.product_id = p.id and v.is_active
    join public.sizes s on s.id = v.size_id
    left join public.inventory i on i.variant_id = v.id
    left join public.warehouses w on w.id = i.warehouse_id
   where p.status = 'active' or private.is_staff()
   group by p.id, p.title, s.label, s.sort_order
   order by p.id, s.sort_order
$$;
comment on function public.get_stock_levels() is 'WEBSITE. Stock per product and size for the whole catalog (capped at 10 for shoppers, real on_hand for staff).';

-- Add-to-bag takes one piece straight off the shelf. Temporary until checkout uses place_order().
create or replace function public.take_inventory(product_name text, size_name text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_variant bigint; v_wh integer;
begin
  select v.id into v_variant
    from public.product_variants v
    join public.products p on p.id = v.product_id and p.status = 'active'
    join public.sizes s on s.id = v.size_id
   where p.title = product_name and s.label = size_name and v.is_active
   order by p.id
   limit 1;
  if v_variant is null then return false; end if;

  select i.warehouse_id into v_wh
    from public.inventory i
    join public.warehouses w on w.id = i.warehouse_id and w.is_active
   where i.variant_id = v_variant and i.available > 0
   order by i.available desc, i.warehouse_id
   limit 1
   for update of i;
  if v_wh is null then return false; end if;

  update public.inventory set on_hand = on_hand - 1 where variant_id = v_variant and warehouse_id = v_wh;
  insert into public.inventory_movements (variant_id, warehouse_id, delta, reason, note, created_by)
  values (v_variant, v_wh, -1, 'sale', 'Website add to bag', auth.uid());
  return true;
end $$;
comment on function public.take_inventory(text, text) is 'WEBSITE (temporary). Add to bag removes one piece of a size; FALSE when sold out. Replace with place_order() once checkout exists.';

-- Admin "SAVE STOCK": sets on_hand per product/size in the main warehouse and logs the change.
-- p_rows = [{"slug":"levi-aura","size":"M","on_hand":12}, ...]
create or replace function public.admin_set_stock(p_rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; v_variant bigint; v_wh integer; v_old integer; v_new integer; n integer := 0;
begin
  if not private.is_staff('warehouse') then raise exception 'Not allowed'; end if;
  select id into v_wh from public.warehouses where is_active order by id limit 1;
  if v_wh is null then raise exception 'Add an active warehouse first'; end if;

  for r in select * from jsonb_to_recordset(p_rows) as x(slug text, size text, on_hand integer) loop
    select v.id into v_variant
      from public.product_variants v
      join public.products p on p.id = v.product_id
      join public.sizes s on s.id = v.size_id
     where p.slug = r.slug and s.label = r.size;
    continue when v_variant is null;

    v_new := greatest(coalesce(r.on_hand, 0), 0);
    select on_hand into v_old from public.inventory where variant_id = v_variant and warehouse_id = v_wh for update;
    continue when v_old is not distinct from v_new;

    insert into public.inventory (variant_id, warehouse_id, on_hand) values (v_variant, v_wh, v_new)
    on conflict (variant_id, warehouse_id) do update set on_hand = excluded.on_hand;
    if v_new <> coalesce(v_old, 0) then
      insert into public.inventory_movements (variant_id, warehouse_id, delta, reason, note, created_by)
      values (v_variant, v_wh, v_new - coalesce(v_old, 0), 'adjustment', 'Set in website admin', auth.uid());
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
comment on function public.admin_set_stock(jsonb) is 'WEBSITE ADMIN. Sets on_hand per product slug + size label in the first active warehouse and writes an adjustment row to inventory_movements.';

revoke execute on function public.admin_set_stock(jsonb) from public, anon;
grant  execute on function public.admin_set_stock(jsonb) to authenticated, service_role;
grant  execute on function public.get_stock_levels(), public.take_inventory(text, text), public.is_admin() to anon, authenticated;

-- Live updates for the site (catalog + stock). Skipped where Realtime is not set up.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.products, public.inventory;
  end if;
end $$;
