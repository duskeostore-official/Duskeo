import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { PRODUCTS } from '../../data/products'
import { supabase } from '../../lib/supabase'
import type { Product, ProductPhoto } from '../../types'
import { CatalogContext } from './catalogContext'

interface ProductRow {
  slug: string
  name: string
  price: number
  theme: Product['theme']
  launched_at: string
  card_alt: string
  description: string
  kicker: string
  photos: ProductPhoto[]
  specs: Product['specs']
  is_dummy: boolean
  is_deleted: boolean
}

const rowToProduct = (row: ProductRow): Product => ({
  slug: row.slug,
  name: row.name,
  price: row.price,
  theme: row.theme,
  launchedAt: row.launched_at,
  cardAlt: row.card_alt,
  description: row.description,
  kicker: row.kicker,
  photos: row.photos?.length ? row.photos : PRODUCTS.find((item) => item.slug === row.slug)?.photos ?? [],
  specs: row.specs?.length ? row.specs : PRODUCTS.find((item) => item.slug === row.slug)?.specs ?? [],
  isDummy: row.is_dummy,
})

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<ProductRow[]>([])

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('products').select('*').order('launched_at', { ascending: false })
    if (!error && data) setRows(data as ProductRow[])
  }, [])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel('catalog-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void load())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load])

  const customProducts = useMemo(
    () => rows.filter((row) => !row.is_deleted && !PRODUCTS.some((item) => item.slug === row.slug)).map(rowToProduct),
    [rows],
  )

  const deletedSlugs = useMemo(() => rows.filter((row) => row.is_deleted).map((row) => row.slug), [rows])

  const products = useMemo(() => {
    const staticProducts = PRODUCTS.filter((product) => !deletedSlugs.includes(product.slug)).map((product) => {
      const row = rows.find((item) => item.slug === product.slug && !item.is_deleted)
      return row ? rowToProduct(row) : product
    })
    const databaseSlugs = new Set(rows.map((row) => row.slug))
    return [
      ...staticProducts,
      ...customProducts.filter((product) => !databaseSlugs.has(product.slug) || !PRODUCTS.some((item) => item.slug === product.slug)),
    ]
  }, [customProducts, deletedSlugs, rows])

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

    const { error } = await supabase.from('products').insert({
      slug: product.slug,
      name: product.name,
      price: product.price,
      theme: product.theme,
      launched_at: product.launchedAt,
      card_alt: product.cardAlt,
      description: product.description,
      kicker: product.kicker,
      photos: uploadedPhotos,
      specs: product.specs,
      is_dummy: false,
      is_deleted: false,
    })
    if (error) return { ok: false, error: error.message }
    await load()
    return { ok: true }
  }, [load, products])

  const deleteProduct = useCallback(async (slug: string) => {
    const product = products.find((item) => item.slug === slug)
    if (!product) return { ok: false, error: 'Product not found.' }
    const { error } = await supabase
      .from('products')
      .update({ is_deleted: true })
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
