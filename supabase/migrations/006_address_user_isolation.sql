-- Ensure saved addresses can only be read and changed by their owning user.
alter table public.addresses enable row level security;

drop policy if exists "own rows" on public.addresses;

create policy "customers manage own addresses"
on public.addresses
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
