import { createContext } from 'react'
import type { CartItem, Size } from '../../types'

export interface CartContextValue {
  items: CartItem[]
  count: number
  subtotal: number
  isOpen: boolean
  open: () => void
  close: () => void
  /** False once this size is at the per-line limit (10). */
  canAdd: (product: string, size: Size) => boolean
  add: (product: string, size: Size, price: number) => void
  increment: (name: string) => void
  decrement: (name: string) => void
  /** Moves a line to another size (merges if that size is already in the bag). */
  changeSize: (name: string, size: Size) => void
  remove: (name: string) => void
  restore: (items: CartItem[]) => Promise<void>
}

export const CartContext = createContext<CartContextValue | null>(null)
