-- Version 008 follows the uniquely numbered address and pincode migrations.
create table if not exists public.storefront_content (
  key text primary key,
  title text not null default '',
  eyebrow text not null default '',
  body text not null default '',
  image_url text not null default '',
  link_url text not null default '',
  active boolean not null default true,
  sort_order smallint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.storefront_content enable row level security;

drop policy if exists "Storefront content is public" on public.storefront_content;
create policy "Storefront content is public"
  on public.storefront_content
  for select
  using (true);

drop policy if exists "Admins manage storefront content" on public.storefront_content;
create policy "Admins manage storefront content"
  on public.storefront_content
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.storefront_content (key, title, eyebrow, body, link_url, active, sort_order)
values
  ('hero', 'BEYOND ORDINARY.', 'THE NEXT CHAPTER', '', '', true, 0),
  ('campaign-1', '', '', '', '', false, 1),
  ('campaign-2', '', '', '', '', false, 2),
  ('campaign-3', '', '', '', '', false, 3),
  ('campaign-4', '', '', '', '', false, 4)
on conflict (key) do nothing;
