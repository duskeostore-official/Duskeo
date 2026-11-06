import { createContext } from 'react'
import type { Product } from '../../types'

export interface QuickAddContextValue {
  /** Opens the size picker for a product card's "ADD TO BAG". */
  open: (product: Product) => void
}

export const QuickAddContext = createContext<QuickAddContextValue | null>(null)
