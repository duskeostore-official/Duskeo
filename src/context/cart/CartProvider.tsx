import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { CartItem } from '../../types'
import { CartContext } from './cartContext'

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)

  const add = useCallback((name: string, price: number) => {
    setItems((prev) =>
      prev.some((i) => i.name === name)
        ? prev.map((i) => (i.name === name ? { ...i, qty: i.qty + 1 } : i))
        : [...prev, { name, price, qty: 1 }],
    )
  }, [])

  const increment = useCallback((name: string) => {
    setItems((prev) => prev.map((i) => (i.name === name ? { ...i, qty: i.qty + 1 } : i)))
  }, [])

  const decrement = useCallback((name: string) => {
    setItems((prev) =>
      prev.map((i) => (i.name === name ? { ...i, qty: i.qty - 1 } : i)).filter((i) => i.qty > 0),
    )
  }, [])

  const remove = useCallback((name: string) => {
    setItems((prev) => prev.filter((i) => i.name !== name))
  }, [])

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: items.reduce((s, i) => s + i.qty * i.price, 0),
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      add,
      increment,
      decrement,
      remove,
    }),
    [items, isOpen, add, increment, decrement, remove],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
