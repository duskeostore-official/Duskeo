import { createContext } from 'react'
import type { Size, Stock } from '../../types'

export interface InventoryContextValue {
  stock: Stock
  quantity: (product: string, size: Size) => number
  /** Takes one unit; returns false (and changes nothing) when sold out. */
  take: (product: string, size: Size) => Promise<boolean>
  replace: (next: Stock) => Promise<{ ok: boolean; error?: string }>
  reset: () => Promise<{ ok: boolean; error?: string }>
}

export const InventoryContext = createContext<InventoryContextValue | null>(null)
