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
    const { data, error } = await supabase
      .from('inventory')
      .select('size, quantity, products(name)')
    if (error || !data) return
    const raw: Partial<Stock> = {}
    data.forEach((row) => {
      const productRows = row.products as unknown
      const productName = Array.isArray(productRows)
        ? (productRows[0] as { name?: string } | undefined)?.name
        : (productRows as { name?: string } | null)?.name
      if (productName && row.size) {
        raw[productName] ??= {} as Record<Size, number>
        raw[productName][row.size as Size] = Number(row.quantity) || 0
      }
    })
    const next = sanitizeStock(raw, productNames)
    stockRef.current = next
    setStock(next)
  }, [productNames])

  useEffect(() => {
    void load()
    const channel = supabase
      .channel('catalog-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => void load())
      .subscribe()
    return () => {
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
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, name')
      .in('name', Object.keys(next))
    if (productError) return { ok: false, error: productError.message }
    const ids = new Map((products ?? []).map((product) => [product.name, product.id]))
    const rows = Object.entries(next).flatMap(([name, quantities]) =>
      ids.has(name)
        ? Object.entries(quantities).map(([size, quantity]) => ({
            product_id: ids.get(name),
            size,
            quantity: Math.max(0, Math.floor(Number(quantity) || 0)),
          }))
        : [],
    )
    const { error } = await supabase.from('inventory').upsert(rows, { onConflict: 'product_id,size' })
    if (error) return { ok: false, error: error.message }
    await load()
    return { ok: true }
  }, [load])

  const reset = useCallback(async () => replace(zeroStock(productNames)), [productNames, replace])

  const value = useMemo(
    () => ({ stock, quantity, take, replace, reset }),
    [stock, quantity, take, replace, reset],
  )

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}
