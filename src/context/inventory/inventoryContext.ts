import { createContext } from 'react'
import type { Size, Stock } from '../../types'

export interface InventoryContextValue {
  stock: Stock
  quantity: (product: string, size: Size) => number
  /** Takes one unit; returns false (and changes nothing) when sold out. */
  take: (product: string, size: Size) => boolean
  replace: (next: Stock) => void
  reset: () => void
}

export const InventoryContext = createContext<InventoryContextValue | null>(null)
