insert into public.storefront_content (key, title, eyebrow, body, image_url, link_url, active, sort_order)
values
  ('campaign-2', 'LIMITLESS', 'GYM COLLECTION', 'PERFORMANCE. DISCIPLINE. PROGRESS.', '/campaigns/limitless-gym.jpeg', '#collection-gym', true, 2),
  ('campaign-3', 'LEGACY', 'MYTHOLOGY COLLECTION', 'ROOTED IN LEGENDS.', '/campaigns/legacy-mythology.jpeg', '#collection-mythology', true, 3),
  ('campaign-4', 'OBLIVION', 'DARK COLLECTION', 'FOR THOSE WHO MOVE IN SHADOWS.', '/campaigns/oblivion-dark.jpeg', '#collection-dark', true, 4)
on conflict (key) do update set
  title = excluded.title,
  eyebrow = excluded.eyebrow,
  body = excluded.body,
  image_url = excluded.image_url,
  link_url = excluded.link_url,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.collections (name, slug, description, image_key, is_active)
values
  ('GYM COLLECTION', 'gym', 'PERFORMANCE. DISCIPLINE. PROGRESS.', '/campaigns/limitless-gym.jpeg', true),
  ('MYTHOLOGY COLLECTION', 'mythology', 'ROOTED IN LEGENDS.', '/campaigns/legacy-mythology.jpeg', true),
  ('DARK COLLECTION', 'dark', 'FOR THOSE WHO MOVE IN SHADOWS.', '/campaigns/oblivion-dark.jpeg', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  image_key = excluded.image_key,
  is_active = excluded.is_active;

with eligible_products as (
  select
    c.id as collection_id,
    p.id as product_id,
    row_number() over (partition by c.id order by p.published_at desc nulls last, p.id) - 1 as sort_order
  from public.collections c
  join public.products p on p.status = 'active'
  where c.slug in ('gym', 'mythology', 'dark')
    and not coalesce(p.tags, '{}'::text[]) @> array['dummy']::text[]
    and (
      (c.slug = 'gym' and (
        lower(coalesce(p.attributes ->> 'theme', '')) in ('gym', 'fitness')
        or exists (
          select 1
          from unnest(coalesce(p.tags, '{}'::text[])) as product_tags(tag)
          where lower(product_tags.tag) = any(array['gym', 'fitness', 'gym-collection']::text[])
        )
      ))
      or (c.slug = 'mythology' and (
        lower(coalesce(p.attributes ->> 'theme', '')) in ('mythic', 'mythology')
        or exists (
          select 1
          from unnest(coalesce(p.tags, '{}'::text[])) as product_tags(tag)
          where lower(product_tags.tag) = any(array['mythic', 'mythology', 'legacy']::text[])
        )
      ))
      or (c.slug = 'dark' and (
        lower(coalesce(p.attributes ->> 'theme', '')) in ('dark', 'darkwear', 'oblivion')
        or exists (
          select 1
          from unnest(coalesce(p.tags, '{}'::text[])) as product_tags(tag)
          where lower(product_tags.tag) = any(array['dark', 'darkwear', 'oblivion']::text[])
        )
      ))
    )
)
insert into public.collection_products (collection_id, product_id, sort_order)
select
  eligible.collection_id,
  eligible.product_id,
  (coalesce(existing.max_sort_order, -1) + eligible.sort_order + 1)::smallint
from eligible_products eligible
left join lateral (
  select max(cp.sort_order) as max_sort_order
  from public.collection_products cp
  where cp.collection_id = eligible.collection_id
) existing on true
on conflict (collection_id, product_id) do nothing;
