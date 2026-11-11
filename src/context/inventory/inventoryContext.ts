import { createContext } from 'react'
import type { Size, Stock } from '../../types'

export interface InventoryContextValue {
  stock: Stock
  quantity: (product: string, size: Size) => number
  replace: (next: Stock) => Promise<{ ok: boolean; error?: string }>
  reset: () => Promise<{ ok: boolean; error?: string }>
}

export const InventoryContext = createContext<InventoryContextValue | null>(null)
