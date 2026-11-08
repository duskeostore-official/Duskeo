insert into public.collections (name, slug, description, image_key, is_active)
values ('ANIME COLLECTION', 'anime', null, '/campaigns/anime.jpeg', true)
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
  where c.slug = 'anime'
    and not coalesce(p.tags, '{}'::text[]) @> array['dummy']::text[]
    and (
      lower(coalesce(p.attributes ->> 'theme', '')) = 'anime'
      or exists (
        select 1
        from unnest(coalesce(p.tags, '{}'::text[])) as product_tags(tag)
        where lower(product_tags.tag) = any(array['anime', 'anime-collection']::text[])
      )
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
