import { createContext } from 'react'
import type { Product } from '../../types'

export interface CatalogContextValue {
  products: Product[]
  customProducts: Product[]
  deletedSlugs: string[]
  addProduct: (product: Product) => Promise<{ ok: boolean; error?: string }>
  deleteProduct: (slug: string) => Promise<{ ok: boolean; error?: string }>
  findProduct: (slug: string) => Product | undefined
}

export const CatalogContext = createContext<CatalogContextValue | null>(null)
