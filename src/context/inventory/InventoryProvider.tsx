import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import type { Size, Stock } from '../../types'
import { sanitizeStock, zeroStock } from '../../utils/inventory'
import { InventoryContext } from './inventoryContext'
import { useCatalog } from '../catalog/useCatalog'

export function InventoryProvider({ children }: { children: ReactNode }) {
  const catalog = useCatalog()
  const productNames = useMemo(() => catalog.products.map((product) => product.name), [catalog.products])
  const [stock, setStock] = useState<Stock>(() => zeroStock(productNames))
  const stockRef = useRef(stock)

  const load = useCallback(async () => {
    // Shoppers get at most 10 per size; staff get the real on-hand count.
    const { data, error } = await supabase.rpc('get_stock_levels')
    if (error || !data) return
    const raw: Partial<Stock> = {}
    ;(data as { product_title: string; size_label: string; quantity: number }[]).forEach((row) => {
      raw[row.product_title] ??= {} as Record<Size, number>
      raw[row.product_title][row.size_label as Size] = Number(row.quantity) || 0
    })
    const next = sanitizeStock(raw, productNames)
    stockRef.current = next
    setStock(next)
  }, [productNames])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0)
    // inventory events reach staff only (RLS); shoppers refresh when products.in_stock / sizes change.
    const channel = supabase
      .channel('catalog-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void load())
      .subscribe()
    return () => {
      window.clearTimeout(initialLoad)
      void supabase.removeChannel(channel)
    }
  }, [load])

  const quantity = useCallback((product: string, size: Size) => stock[product]?.[size] ?? 0, [stock])

  const take = useCallback(async (product: string, size: Size) => {
    const { data, error } = await supabase.rpc('take_inventory', {
      product_name: product,
      size_name: size,
    })
    if (error || data !== true) return false
    const next = {
      ...stockRef.current,
      [product]: {
        ...stockRef.current[product],
        [size]: Math.max(0, (stockRef.current[product]?.[size] ?? 0) - 1),
      },
    }
    stockRef.current = next
    setStock(next)
    return true
  }, [])

  const replace = useCallback(async (next: Stock) => {
    const slugs = new Map(catalog.products.map((product) => [product.name, product.slug]))
    const rows = Object.entries(next).flatMap(([name, quantities]) =>
      slugs.has(name)
        ? Object.entries(quantities).map(([size, quantity]) => ({
            slug: slugs.get(name),
            size,
            on_hand: Math.max(0, Math.floor(Number(quantity) || 0)),
          }))
        : [],
    )
    const { error } = await supabase.rpc('admin_set_stock', { p_rows: rows })
    if (error) return { ok: false, error: error.message }
    await load()
    return { ok: true }
  }, [catalog.products, load])

  const reset = useCallback(async () => replace(zeroStock(productNames)), [productNames, replace])

  const value = useMemo(
    () => ({ stock, quantity, take, replace, reset }),
    [stock, quantity, take, replace, reset],
  )

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}
