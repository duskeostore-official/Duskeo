create table public.shipping_package_presets (
  preset_key text primary key check (preset_key in ('one_tshirt', 'two_tshirts', 'three_or_more')),
  label text not null,
  min_quantity integer not null check (min_quantity > 0),
  max_quantity integer,
  weight_grams integer not null check (weight_grams between 1 and 50000),
  length_cm numeric(6,2) not null check (length_cm between 0.5 and 200),
  width_cm numeric(6,2) not null check (width_cm between 0.5 and 200),
  height_cm numeric(6,2) not null check (height_cm between 0.5 and 200),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint shipping_package_preset_quantity_range check (
    max_quantity is null or max_quantity >= min_quantity
  )
);

alter table public.shipping_package_presets enable row level security;
create policy "Admins can read shipping package presets"
  on public.shipping_package_presets for select to authenticated
  using (public.is_admin());
create policy "Admins can update shipping package presets"
  on public.shipping_package_presets for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
revoke update on public.shipping_package_presets from authenticated;
grant select on public.shipping_package_presets to authenticated, service_role;
grant update (weight_grams, length_cm, width_cm, height_cm, updated_at, updated_by)
  on public.shipping_package_presets to authenticated, service_role;

insert into public.shipping_package_presets
  (preset_key, label, min_quantity, max_quantity, weight_grams, length_cm, width_cm, height_cm)
values
  ('one_tshirt', '1 T-shirt', 1, 1, 500, 30, 25, 5),
  ('two_tshirts', '2 T-shirts', 2, 2, 900, 32, 28, 7),
  ('three_or_more', '3 or more T-shirts', 3, null, 1300, 35, 30, 10)
on conflict (preset_key) do nothing;

create table public.order_shipping_packages (
  order_id bigint not null references public.orders(id) on delete cascade,
  warehouse_id integer not null references public.warehouses(id),
  package_preset_key text not null references public.shipping_package_presets(preset_key),
  item_quantity integer not null check (item_quantity > 0),
  weight_grams integer not null check (weight_grams between 1 and 50000),
  length_cm numeric(6,2) not null check (length_cm between 0.5 and 200),
  width_cm numeric(6,2) not null check (width_cm between 0.5 and 200),
  height_cm numeric(6,2) not null check (height_cm between 0.5 and 200),
  package_overridden boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (order_id, warehouse_id)
);

alter table public.order_shipping_packages enable row level security;
create policy "Admins can read order shipping packages"
  on public.order_shipping_packages for select to authenticated
  using (public.is_admin());
grant select on public.order_shipping_packages to authenticated, service_role;

create or replace function private.assign_order_shipping_packages()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare
  v_package record;
begin
  for v_package in
    select oi.warehouse_id, sum(oi.quantity)::integer as item_quantity
      from public.order_items oi
     where oi.order_id = new.id and oi.status <> 'cancelled'
     group by oi.warehouse_id
  loop
    insert into public.order_shipping_packages (
      order_id, warehouse_id, package_preset_key, item_quantity,
      weight_grams, length_cm, width_cm, height_cm
    )
    select new.id, v_package.warehouse_id, preset.preset_key, v_package.item_quantity,
           preset.weight_grams, preset.length_cm, preset.width_cm, preset.height_cm
      from public.shipping_package_presets preset
     where v_package.item_quantity >= preset.min_quantity
       and (preset.max_quantity is null or v_package.item_quantity <= preset.max_quantity)
    on conflict (order_id, warehouse_id) do nothing;
  end loop;
  return new;
end $$;

create trigger orders_assign_shipping_packages
after update of status on public.orders
for each row when (new.status = 'placed' and old.status is distinct from new.status)
execute function private.assign_order_shipping_packages();

insert into public.order_shipping_packages (
  order_id, warehouse_id, package_preset_key, item_quantity, weight_grams, length_cm, width_cm, height_cm
)
select counts.order_id, counts.warehouse_id, preset.preset_key, counts.item_quantity,
       preset.weight_grams, preset.length_cm, preset.width_cm, preset.height_cm
  from (
    select oi.order_id, oi.warehouse_id, sum(oi.quantity)::integer as item_quantity
      from public.order_items oi
      join public.orders o on o.id = oi.order_id and o.status = 'placed'
     where oi.status <> 'cancelled'
     group by oi.order_id, oi.warehouse_id
  ) counts
  join public.shipping_package_presets preset
    on counts.item_quantity >= preset.min_quantity
   and (preset.max_quantity is null or counts.item_quantity <= preset.max_quantity)
on conflict (order_id, warehouse_id) do nothing;

alter table public.shipments
  add column package_preset_key text references public.shipping_package_presets(preset_key),
  add column package_weight_grams integer,
  add column package_length_cm numeric(6,2),
  add column package_width_cm numeric(6,2),
  add column package_height_cm numeric(6,2),
  add column package_overridden boolean not null default false,
  add column nimbuspost_order_id text;

alter table public.shipments
  add constraint shipments_package_snapshot_check check (
    (package_weight_grams is null and package_length_cm is null and package_width_cm is null and package_height_cm is null)
    or (
      package_weight_grams is not null
      and package_length_cm is not null
      and package_width_cm is not null
      and package_height_cm is not null
      and
      package_weight_grams between 1 and 50000
      and package_length_cm between 0.5 and 200
      and package_width_cm between 0.5 and 200
      and package_height_cm between 0.5 and 200
    )
  );
create unique index shipments_nimbuspost_order_id_key
  on public.shipments (nimbuspost_order_id)
  where nimbuspost_order_id is not null;

create table public.nimbuspost_shipment_bookings (
  id uuid primary key default gen_random_uuid(),
  order_id bigint not null references public.orders(id),
  item_ids bigint[] not null,
  nimbuspost_order_number text not null unique,
  status text not null default 'pending' check (status in ('pending', 'booked', 'failed')),
  nimbuspost_order_id text,
  shipment_id bigint unique references public.shipments(id),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, item_ids)
);

alter table public.nimbuspost_shipment_bookings enable row level security;
revoke all on public.nimbuspost_shipment_bookings from anon, authenticated;
grant select, insert, update on public.nimbuspost_shipment_bookings to service_role;

create or replace function public.reserve_nimbuspost_shipment(p_order_id bigint, p_item_ids bigint[])
returns table (booking_id uuid, nimbuspost_order_number text)
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_item_ids bigint[];
  v_warehouse_id integer;
  v_booking public.nimbuspost_shipment_bookings%rowtype;
begin
  if not private.is_service() then raise exception 'Not allowed'; end if;
  if p_item_ids is null or cardinality(p_item_ids) = 0
    or cardinality(p_item_ids) > 50
    or cardinality(p_item_ids) <> (select count(distinct item_id) from unnest(p_item_ids) as ids(item_id)) then
    raise exception 'Invalid shipment item selection';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status <> 'placed' then raise exception 'Order is not ready to ship'; end if;

  select array_agg(oi.id order by oi.id), min(oi.warehouse_id)
    into v_item_ids, v_warehouse_id
    from public.order_items oi
   where oi.order_id = p_order_id and oi.id = any (p_item_ids)
     and oi.status = 'placed' and oi.shipment_id is null
   having count(*) = cardinality(p_item_ids) and count(distinct oi.warehouse_id) = 1;
  if v_item_ids is null then raise exception 'Items must be unshipped and from this order and warehouse'; end if;

  select * into v_booking
    from public.nimbuspost_shipment_bookings
   where order_id = p_order_id and item_ids = v_item_ids
   for update;
  if found then
    if v_booking.status <> 'failed' then
      raise exception 'A NimbusPost booking is already in progress or has completed for these items';
    end if;
    update public.nimbuspost_shipment_bookings
       set status = 'pending', nimbuspost_order_id = null, shipment_id = null,
           error_message = null, updated_at = now()
     where id = v_booking.id
     returning * into v_booking;
  else
    insert into public.nimbuspost_shipment_bookings
      (order_id, item_ids, nimbuspost_order_number)
    values
      (p_order_id, v_item_ids, 'DSK-' || p_order_id || '-' || v_warehouse_id || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
    returning * into v_booking;
  end if;

  return query select v_booking.id, v_booking.nimbuspost_order_number;
end $$;

create or replace function public.fail_nimbuspost_shipment(p_booking_id uuid, p_error text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not private.is_service() then raise exception 'Not allowed'; end if;
  update public.nimbuspost_shipment_bookings
     set status = 'failed', error_message = left(coalesce(p_error, 'NimbusPost rejected the shipment request'), 500),
         updated_at = now()
   where id = p_booking_id and status = 'pending';
  if not found then raise exception 'NimbusPost booking reservation not found'; end if;
end $$;

create or replace function public.complete_nimbuspost_shipment(
  p_booking_id uuid,
  p_nimbuspost_order_id text,
  p_courier text,
  p_awb text,
  p_tracking_url text,
  p_package_preset_key text,
  p_package_weight_grams integer,
  p_package_length_cm numeric,
  p_package_width_cm numeric,
  p_package_height_cm numeric,
  p_package_overridden boolean
)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_booking public.nimbuspost_shipment_bookings%rowtype;
  v_order public.orders%rowtype;
  v_warehouse_id integer;
  v_cod integer := 0;
  v_shipment_id bigint;
begin
  if not private.is_service() then raise exception 'Not allowed'; end if;
  if nullif(trim(p_nimbuspost_order_id), '') is null
    or nullif(trim(p_courier), '') is null
    or nullif(trim(p_awb), '') is null then
    raise exception 'NimbusPost booking response is missing shipment details';
  end if;
  if p_package_weight_grams not between 1 and 50000
    or p_package_length_cm not between 0.5 and 200
    or p_package_width_cm not between 0.5 and 200
    or p_package_height_cm not between 0.5 and 200 then
    raise exception 'Invalid package details';
  end if;

  select * into v_booking from public.nimbuspost_shipment_bookings where id = p_booking_id for update;
  if not found or v_booking.status <> 'pending' then raise exception 'NimbusPost booking is not pending'; end if;
  select * into v_order from public.orders where id = v_booking.order_id for update;
  if not found or v_order.status <> 'placed' then raise exception 'Order is not ready to ship'; end if;

  select min(warehouse_id) into v_warehouse_id
    from public.order_items
   where order_id = v_booking.order_id and id = any (v_booking.item_ids)
     and status = 'placed' and shipment_id is null
   having count(*) = cardinality(v_booking.item_ids) and count(distinct warehouse_id) = 1;
  if v_warehouse_id is null then raise exception 'Items have already been assigned to a shipment'; end if;
  if v_order.payment_method = 'cod' then
    select coalesce(sum(line_total_paise), 0) into v_cod
      from public.order_items where id = any (v_booking.item_ids);
    if not exists (select 1 from public.shipments where order_id = v_booking.order_id) then
      v_cod := v_cod + v_order.shipping_fee_paise + v_order.cod_fee_paise + v_order.platform_fee_paise;
    end if;
  end if;

  insert into public.shipments (
    order_id, warehouse_id, courier, awb_number, tracking_url, cod_amount_paise,
    package_preset_key, package_weight_grams, package_length_cm, package_width_cm,
    package_height_cm, package_overridden, nimbuspost_order_id
  )
  values (
    v_booking.order_id, v_warehouse_id, trim(p_courier), trim(p_awb), nullif(trim(p_tracking_url), ''), v_cod,
    p_package_preset_key, p_package_weight_grams, p_package_length_cm, p_package_width_cm,
    p_package_height_cm, coalesce(p_package_overridden, false), trim(p_nimbuspost_order_id)
  )
  returning id into v_shipment_id;

  update public.order_items set shipment_id = v_shipment_id, status = 'packed'
   where id = any (v_booking.item_ids);
  update public.nimbuspost_shipment_bookings
     set status = 'booked', nimbuspost_order_id = trim(p_nimbuspost_order_id),
         shipment_id = v_shipment_id, error_message = null, updated_at = now()
   where id = p_booking_id;
  return v_shipment_id;
end $$;

revoke execute on function public.reserve_nimbuspost_shipment(bigint, bigint[]) from public, anon, authenticated;
revoke execute on function public.fail_nimbuspost_shipment(uuid, text) from public, anon, authenticated;
revoke execute on function public.complete_nimbuspost_shipment(uuid, text, text, text, text, text, integer, numeric, numeric, numeric, boolean) from public, anon, authenticated;
grant execute on function public.reserve_nimbuspost_shipment(bigint, bigint[]) to service_role;
grant execute on function public.fail_nimbuspost_shipment(uuid, text) to service_role;
grant execute on function public.complete_nimbuspost_shipment(uuid, text, text, text, text, text, integer, numeric, numeric, numeric, boolean) to service_role;
