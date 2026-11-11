alter table public.custom_design_requests
  add column if not exists front_image_path text,
  add column if not exists back_image_path text;

grant insert (customer_name, email, phone, garment, size, details, front_image_path, back_image_path)
  on public.custom_design_requests to anon, authenticated;
