import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SIZES } from '../../constants/site'
import { PRODUCTS } from '../../data/products'
import { supabase } from '../../lib/supabase'
import type { Product, ProductPhoto, ProductSpec, ProductTheme } from '../../types'
import { CatalogContext } from './catalogContext'

/** Leaf category every Duskeo tee is filed under (seeded by migration 003). */
const DEFAULT_CATEGORY_SLUG = 'oversized-tshirts'
const DEFAULT_KICKER = 'DUSKEO / GRAPHIC COLLECTION'

interface ProductRow {
  slug: string
  title: string
  description: string | null
  price_paise: number
  attributes: Record<string, string> | null
  images: string[] | null
  tags: string[] | null
  status: 'draft' | 'active' | 'archived'
  published_at: string | null
  colors: { name: string } | null
}

const PRODUCT_COLUMNS = 'slug, title, description, price_paise, attributes, images, tags, status, published_at, colors(name)'

/** products.attributes key <-> spec label, e.g. fabric_finish <-> FABRIC FINISH */
const specLabel = (key: string) => key.replace(/_/g, ' ').toUpperCase()
const attributeKey = (label: string) => label.trim().toLowerCase().replace(/[^a-z]+/g, '_')

const rowToProduct = (row: ProductRow): Product => {
  const fallback = PRODUCTS.find((item) => item.slug === row.slug)
  const { theme, ...specAttributes } = row.attributes ?? {}
  const specs: ProductSpec[] = [
    ...(row.colors ? [{ label: 'COLOR', value: row.colors.name.toUpperCase() }] : []),
    ...Object.entries(specAttributes).map(([key, value]) => ({ label: specLabel(key), value: String(value) })),
  ]
  const photos: ProductPhoto[] = (row.images ?? []).map((src, index) => ({
    src,
    label: index === 0 ? 'Front view' : `View ${index + 1}`,
    alt: `${row.title}${index === 0 ? ' front view' : ` view ${index + 1}`}`,
  }))
  return {
    slug: row.slug,
    name: row.title,
    price: row.price_paise / 100,
    theme: (theme as ProductTheme | undefined) ?? fallback?.theme ?? 'Anime',
    launchedAt: row.published_at?.slice(0, 10) ?? fallback?.launchedAt ?? '',
    cardAlt: fallback?.cardAlt ?? `${row.title} front view`,
    description: row.description ?? '',
    kicker: fallback?.kicker ?? DEFAULT_KICKER,
    photos: photos.length ? photos : fallback?.photos ?? [],
    specs: specs.length > 1 ? specs : fallback?.specs ?? specs,
    isDummy: row.tags?.includes('dummy') ?? false,
  }
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  // null until the first successful load: the bundled catalog is shown meanwhile.
  const [rows, setRows] = useState<ProductRow[] | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .order('published_at', { ascending: false })
    if (!error && data) setRows(data as unknown as ProductRow[])
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0)
    const channel = supabase
      .channel('catalog-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void load())
      .subscribe()
    return () => {
      window.clearTimeout(initialLoad)
      void supabase.removeChannel(channel)
    }
  }, [load])

  const liveProducts = useMemo(
    () => (rows ?? []).filter((row) => row.status === 'active').map(rowToProduct),
    [rows],
  )

  const customProducts = useMemo(
    () => liveProducts.filter((product) => !PRODUCTS.some((item) => item.slug === product.slug)),
    [liveProducts],
  )

  // Only staff can read archived rows, so shoppers get an empty list here.
  const deletedSlugs = useMemo(
    () => (rows ?? []).filter((row) => row.status === 'archived').map((row) => row.slug),
    [rows],
  )

  const products = useMemo(() => {
    if (!rows) return PRODUCTS
    // Real products come from the database; bundled dummies show until a row with their slug exists.
    const databaseSlugs = new Set(rows.map((row) => row.slug))
    const bundled = PRODUCTS.flatMap((product) => {
      const live = liveProducts.find((item) => item.slug === product.slug)
      if (live) return [live]
      return product.isDummy && !databaseSlugs.has(product.slug) ? [product] : []
    })
    return [...bundled, ...customProducts]
  }, [customProducts, liveProducts, rows])

  const findProduct = useCallback(
    (slug: string) => products.find((product) => product.slug === slug),
    [products],
  )

  const addProduct = useCallback(async (product: Product) => {
    if (!product.slug || !product.name || !product.description || !product.photos.length) {
      return { ok: false, error: 'Invalid product data.' }
    }
    if (products.some((item) => item.slug === product.slug)) {
      return { ok: false, error: 'A product with this URL name already exists.' }
    }
    if (products.some((item) => item.name.trim().toLowerCase() === product.name.trim().toLowerCase())) {
      return { ok: false, error: 'A product with this name already exists.' }
    }

    const colorName = product.specs.find((spec) => spec.label === 'COLOR')?.value ?? 'Black'
    const [{ data: category }, { data: color }, { data: sizes }] = await Promise.all([
      supabase.from('categories').select('id').eq('slug', DEFAULT_CATEGORY_SLUG).maybeSingle(),
      supabase.from('colors').select('id, name').ilike('name', colorName).maybeSingle(),
      supabase.from('sizes').select('id, label').eq('system', 'alpha').in('label', [...SIZES]),
    ])
    if (!category || !color || !sizes?.length) {
      return { ok: false, error: `Missing catalog setup in Supabase (category, color "${colorName}" or sizes).` }
    }

    const uploadedPhotos: ProductPhoto[] = []
    for (const [index, photo] of product.photos.entries()) {
      let file: Blob
      try {
        file = await fetch(photo.src).then((response) => response.blob())
      } catch {
        return { ok: false, error: 'Could not prepare one of the product photos.' }
      }
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${product.slug}/${Date.now()}-${index}.${extension}`
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file, {
        contentType: file.type,
        upsert: false,
      })
      if (uploadError) return { ok: false, error: uploadError.message }
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      uploadedPhotos.push({ ...photo, src: data.publicUrl })
    }

    const styleCode = `DSK-${product.slug.toUpperCase()}`
    const pricePaise = Math.round(product.price * 100)
    const { data: inserted, error } = await supabase
      .from('products')
      .insert({
        style_code: styleCode,
        category_id: category.id,
        color_id: color.id,
        gender: 'unisex',
        title: product.name,
        slug: product.slug,
        description: product.description,
        attributes: {
          theme: product.theme,
          ...Object.fromEntries(
            product.specs.filter((spec) => spec.label !== 'COLOR').map((spec) => [attributeKey(spec.label), spec.value]),
          ),
        },
        images: uploadedPhotos.map((photo) => photo.src),
        mrp_paise: pricePaise,
        price_paise: pricePaise,
        status: 'active',
        published_at: product.launchedAt,
      })
      .select('id')
      .single()
    if (error || !inserted) return { ok: false, error: error?.message ?? 'Could not save the product.' }

    const colorCode = color.name.replace(/\s+/g, '').slice(0, 3).toUpperCase()
    const { error: variantError } = await supabase.from('product_variants').insert(
      sizes.map((size) => ({ product_id: inserted.id, size_id: size.id, sku: `${styleCode}-${colorCode}-${size.label}` })),
    )
    if (variantError) {
      await supabase.from('products').delete().eq('id', inserted.id)
      return { ok: false, error: variantError.message }
    }
    await load()
    return { ok: true }
  }, [load, products])

  const deleteProduct = useCallback(async (slug: string) => {
    const product = products.find((item) => item.slug === slug)
    if (!product) return { ok: false, error: 'Product not found.' }
    // Archived, not deleted: old orders still point at the product.
    const { error } = await supabase
      .from('products')
      .update({ status: 'archived' })
      .eq('slug', slug)
    if (error) return { ok: false, error: error.message }
    await load()
    return { ok: true }
  }, [load, products])

  const value = useMemo(
    () => ({ products, customProducts, deletedSlugs, addProduct, deleteProduct, findProduct }),
    [products, customProducts, deletedSlugs, addProduct, deleteProduct, findProduct],
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}
