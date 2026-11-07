-- Exact place/state lookup cache. This is separate from serviceable_pincodes,
-- because serviceable_pincodes controls whether delivery is allowed.
create table if not exists public.pincode_locations (
  pincode char(6) primary key
    constraint pincode_locations_valid_pincode
    check (pincode ~ '^[1-9][0-9]{5}$'),
  place text not null,
  district text,
  state text not null,
  updated_at timestamptz not null default now()
);

alter table public.pincode_locations enable row level security;

drop policy if exists "read: everyone" on public.pincode_locations;
create policy "read: everyone"
on public.pincode_locations
for select
using (true);

drop policy if exists "customers cache pincode locations" on public.pincode_locations;
create policy "customers cache pincode locations"
on public.pincode_locations
for insert
to authenticated
with check (true);

drop policy if exists "customers update cached pincode locations" on public.pincode_locations;
create policy "customers update cached pincode locations"
on public.pincode_locations
for update
to authenticated
using (true)
with check (true);

grant select on public.pincode_locations to anon, authenticated;
grant insert, update on public.pincode_locations to authenticated;
