import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { STORAGE_KEYS } from '../../constants/storage'
import { PRODUCTS } from '../../data/products'
import type { Product } from '../../types'
import { readJson, writeJson } from '../../utils/storage'
import { CatalogContext } from './catalogContext'

const isProduct = (value: unknown): value is Product => {
  if (!value || typeof value !== 'object') return false
  const p = value as Partial<Product>
  return typeof p.slug === 'string'
    && typeof p.name === 'string'
    && typeof p.price === 'number'
    && typeof p.description === 'string'
    && Array.isArray(p.photos)
    && p.photos.length > 0
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [customProducts, setCustomProducts] = useState<Product[]>(() =>
    (readJson<unknown[]>(STORAGE_KEYS.catalogCustom, [])).filter(isProduct),
  )
  const [deletedSlugs, setDeletedSlugs] = useState<string[]>(() =>
    readJson<string[]>(STORAGE_KEYS.catalogDeleted, []).filter((slug) => typeof slug === 'string'),
  )

  const products = useMemo(
    () => [
      ...PRODUCTS.filter((product) => !deletedSlugs.includes(product.slug)),
      ...customProducts.filter((product) => !deletedSlugs.includes(product.slug)),
    ],
    [customProducts, deletedSlugs],
  )

  const findProduct = useCallback(
    (slug: string) => products.find((product) => product.slug === slug),
    [products],
  )

  const addProduct = useCallback((product: Product) => {
    if (!isProduct(product)) return { ok: false, error: 'Invalid product data.' }
    const current = products
    if (current.some((item) => item.slug === product.slug)) return { ok: false, error: 'A product with this URL name already exists.' }
    if (current.some((item) => item.name.trim().toLowerCase() === product.name.trim().toLowerCase())) {
      return { ok: false, error: 'A product with this name already exists.' }
    }

    const next = [...customProducts, product]
    if (!writeJson(STORAGE_KEYS.catalogCustom, next)) return { ok: false, error: 'Browser storage is full. Use a smaller image or fewer photos.' }
    const nextDeleted = deletedSlugs.filter((slug) => slug !== product.slug)
    writeJson(STORAGE_KEYS.catalogDeleted, nextDeleted)
    setCustomProducts(next)
    setDeletedSlugs(nextDeleted)
    return { ok: true }
  }, [customProducts, products, deletedSlugs])

  const deleteProduct = useCallback((slug: string) => {
    const custom = customProducts.filter((product) => product.slug !== slug)
    const nextDeleted = [...new Set([...deletedSlugs, slug])]
    writeJson(STORAGE_KEYS.catalogCustom, custom)
    writeJson(STORAGE_KEYS.catalogDeleted, nextDeleted)
    setCustomProducts(custom)
    setDeletedSlugs(nextDeleted)
  }, [customProducts, deletedSlugs])

  const value = useMemo(
    () => ({ products, customProducts, deletedSlugs, addProduct, deleteProduct, findProduct }),
    [products, customProducts, deletedSlugs, addProduct, deleteProduct, findProduct],
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}
