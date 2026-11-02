import { createContext } from 'react'
import type { CartItem } from '../../types'

export interface CartContextValue {
  items: CartItem[]
  count: number
  subtotal: number
  isOpen: boolean
  open: () => void
  close: () => void
  add: (name: string, price: number) => void
  increment: (name: string) => void
  decrement: (name: string) => void
  remove: (name: string) => void
}

export const CartContext = createContext<CartContextValue | null>(null)
