-- =====================================================================
--  005: delivery check for the "ADD TO BAG" size picker
--  While serviceable_pincodes is empty every valid Indian PIN is deliverable
--  (Duskeo ships all over India for now). Load the courier's PIN list into
--  serviceable_pincodes and only those PINs pass, with no code change.
-- =====================================================================
create or replace function public.check_delivery(p_slug text, p_pincode text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_pin public.serviceable_pincodes%rowtype;
  v_strict boolean := exists (select 1 from public.serviceable_pincodes);
  v_ok boolean := true;
  v_sizes jsonb;
begin
  if coalesce(p_pincode, '') !~ '^[1-9][0-9]{5}$' then
    return jsonb_build_object('valid', false, 'deliverable', false, 'sizes', '[]'::jsonb);
  end if;
  if v_strict then
    select * into v_pin from public.serviceable_pincodes where pincode = p_pincode;
    v_ok := found and v_pin.is_serviceable;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('size', s.size_label, 'available', s.available) order by z.sort_order), '[]'::jsonb)
    into v_sizes
    from public.products p
    cross join lateral public.get_variant_stock(p.id) s
    join public.sizes z on z.id = s.size_id
   where p.slug = p_slug and p.status = 'active' and v_ok and s.available > 0;

  return jsonb_build_object(
    'valid', true,
    'deliverable', v_ok,
    'cod_available', case when v_strict then coalesce(v_pin.cod_available, false) else true end,
    'delivery_days', v_pin.delivery_days,
    'city', v_pin.city,
    'state', v_pin.state,
    'sizes', v_sizes);
end $$;
comment on function public.check_delivery(text, text) is 'WEBSITE. Size picker: can this PIN get the product, and which sizes are in stock (capped at 10). All valid PINs pass while serviceable_pincodes is empty.';
grant execute on function public.check_delivery(text, text) to anon, authenticated;
