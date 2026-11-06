import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { STORAGE_KEYS } from '../../constants/storage'
import { supabase } from '../../lib/supabase'
import type { CartItem, Size } from '../../types'
import { readJson, writeJson } from '../../utils/storage'
import { CartContext } from './cartContext'

/** Same limit as the cart_items.quantity check in the database. */
const MAX_QTY = 10

const lineName = (product: string, size: string) => `${product} — ${size}`

interface CartRow {
  variant_id: number
  quantity: number
  product_variants: { sizes: { label: string } | null; products: { title: string; price_paise: number } | null } | null
}

/**
 * Signed in: the bag is saved in cart_items, so it comes back after signing out and in again.
 * Guest: the bag is kept in this browser and merged into the saved bag at sign-in.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readJson<CartItem[]>(STORAGE_KEYS.guestBag, []))
  const [isOpen, setIsOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const itemsRef = useRef(items)
  const userRef = useRef<string | null>(null)
  const variantIds = useRef(new Map<string, number>())

  const commit = useCallback((next: CartItem[]) => {
    itemsRef.current = next
    setItems(next)
    if (!userRef.current) writeJson(STORAGE_KEYS.guestBag, next)
  }, [])

  const variantId = useCallback(async (product: string, size: string) => {
    const name = lineName(product, size)
    const cached = variantIds.current.get(name)
    if (cached) return cached
    const { data } = await supabase
      .from('product_variants')
      .select('id, products!inner(title), sizes!inner(label)')
      .eq('products.title', product)
      .eq('sizes.label', size)
      .limit(1)
      .maybeSingle()
    if (data) variantIds.current.set(name, data.id)
    return data?.id ?? null
  }, [])

  /** Mirrors one line into cart_items; quantity 0 deletes it. Does nothing for guests. */
  const save = useCallback(
    async (product: string, size: string, qty: number, user = userRef.current) => {
      if (!user) return
      const id = await variantId(product, size)
      if (!id) return
      if (qty > 0) await supabase.from('cart_items').upsert({ user_id: user, variant_id: id, quantity: qty })
      else await supabase.from('cart_items').delete().eq('user_id', user).eq('variant_id', id)
    },
    [variantId],
  )

  const loadSaved = useCallback(
    async (user: string) => {
      const { data, error } = await supabase
        .from('cart_items')
        .select('variant_id, quantity, product_variants(sizes(label), products(title, price_paise))')
        .eq('user_id', user)
        .order('added_at')
      if (error || !data || userRef.current !== user) return
      // Lines for products that are no longer live come back without a product and are skipped.
      const next = (data as unknown as CartRow[]).flatMap((row) => {
        const product = row.product_variants?.products
        const size = row.product_variants?.sizes?.label
        if (!product || !size) return []
        const name = lineName(product.title, size)
        variantIds.current.set(name, row.variant_id)
        return [{ name, product: product.title, size: size as Size, price: product.price_paise / 100, qty: row.quantity }]
      })
      commit(next)
    },
    [commit],
  )

  useEffect(() => {
    // supabase-js: don't call Supabase inside this callback; the effect below does the work.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const previous = userRef.current
    userRef.current = userId
    if (!userId) {
      if (previous) commit([]) // signed out: the saved bag stays in the database
      return
    }
    const guestItems = previous ? [] : itemsRef.current
    writeJson(STORAGE_KEYS.guestBag, [])
    void (async () => {
      if (guestItems.length) {
        await loadSaved(userId)
        for (const item of guestItems) {
          const saved = itemsRef.current.find((i) => i.name === item.name)?.qty ?? 0
          await save(item.product, item.size, Math.min(MAX_QTY, saved + item.qty), userId)
        }
      }
      await loadSaved(userId)
    })()
  }, [commit, loadSaved, save, userId])

  const setQty = useCallback(
    (product: string, size: Size, price: number, qty: number) => {
      const name = lineName(product, size)
      const quantity = Math.max(0, Math.min(MAX_QTY, qty))
      const current = itemsRef.current
      const next =
        quantity === 0
          ? current.filter((i) => i.name !== name)
          : current.some((i) => i.name === name)
            ? current.map((i) => (i.name === name ? { ...i, qty: quantity } : i))
            : [...current, { name, product, size, price, qty: quantity }]
      commit(next)
      void save(product, size, quantity)
    },
    [commit, save],
  )

  const line = useCallback((name: string) => itemsRef.current.find((i) => i.name === name), [])

  const canAdd = useCallback(
    (product: string, size: Size) => (line(lineName(product, size))?.qty ?? 0) < MAX_QTY,
    [line],
  )

  const add = useCallback(
    (product: string, size: Size, price: number) =>
      setQty(product, size, price, (line(lineName(product, size))?.qty ?? 0) + 1),
    [line, setQty],
  )

  const increment = useCallback(
    (name: string) => {
      const item = line(name)
      if (item) setQty(item.product, item.size, item.price, item.qty + 1)
    },
    [line, setQty],
  )

  const decrement = useCallback(
    (name: string) => {
      const item = line(name)
      if (item) setQty(item.product, item.size, item.price, item.qty - 1)
    },
    [line, setQty],
  )

  /** Switches a line to another size; merges into that size's line if it is already in the bag. */
  const changeSize = useCallback(
    (name: string, size: Size) => {
      const item = line(name)
      if (!item || item.size === size) return
      const targetName = lineName(item.product, size)
      const target = line(targetName)
      const qty = Math.min(MAX_QTY, (target?.qty ?? 0) + item.qty)
      const next = itemsRef.current.flatMap((i) => {
        if (i.name === name) return target ? [] : [{ ...i, name: targetName, size, qty }]
        return i.name === targetName ? [{ ...i, qty }] : [i]
      })
      commit(next)
      void save(item.product, item.size, 0)
      void save(item.product, size, qty)
    },
    [commit, line, save],
  )

  const remove = useCallback(
    (name: string) => {
      const item = line(name)
      if (item) setQty(item.product, item.size, item.price, 0)
    },
    [line, setQty],
  )

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: items.reduce((s, i) => s + i.qty * i.price, 0),
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      canAdd,
      add,
      increment,
      decrement,
      changeSize,
      remove,
    }),
    [items, isOpen, canAdd, add, increment, decrement, changeSize, remove],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
