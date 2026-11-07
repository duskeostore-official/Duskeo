import { supabase } from './supabase'

export interface StorefrontContent {
  key: string
  title: string
  eyebrow: string
  body: string
  image_url: string
  link_url: string
  active: boolean
  sort_order: number
}

export async function loadStorefrontContent() {
  const { data, error } = await supabase
    .from('storefront_content')
    .select('key, title, eyebrow, body, image_url, link_url, active, sort_order')
    .order('sort_order')
  return { data: (data ?? []) as StorefrontContent[], error }
}

export async function saveStorefrontContent(content: StorefrontContent) {
  const { error } = await supabase.from('storefront_content').upsert({
    ...content,
    updated_at: new Date().toISOString(),
  })
  return { ok: !error, error: error?.message }
}

export async function uploadStorefrontImage(key: string, file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return { ok: false as const, error: 'Use a JPG, PNG, or WebP image.' }
  }
  if (file.size > 5_000_000) {
    return { ok: false as const, error: 'Image must be smaller than 5 MB.' }
  }
  const extension = file.name.split('.').pop()?.toLowerCase() || 'webp'
  const path = `storefront/${key}-${Date.now()}.${extension}`
  const { error } = await supabase.storage.from('product-images').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type,
  })
  if (error) return { ok: false as const, error: error.message }
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return { ok: true as const, url: data.publicUrl }
}
