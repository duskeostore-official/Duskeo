import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { STORAGE_KEYS } from '../../constants/storage'
import type { Size, Stock } from '../../types'
import { sanitizeStock as sanitize, zeroStock } from '../../utils/inventory'
import { readJson, writeJson } from '../../utils/storage'
import { InventoryContext } from './inventoryContext'

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [stock, setStock] = useState<Stock>(() => sanitize(readJson<Partial<Stock> | null>(STORAGE_KEYS.inventory, null)))
  const stockRef = useRef(stock)

  useEffect(() => {
    stockRef.current = stock
    writeJson(STORAGE_KEYS.inventory, stock)
  }, [stock])

  const quantity = useCallback((product: string, size: Size) => stock[product]?.[size] ?? 0, [stock])

  const take = useCallback((product: string, size: Size) => {
    if ((stockRef.current[product]?.[size] ?? 0) < 1) return false
    const next = { ...stockRef.current, [product]: { ...stockRef.current[product], [size]: stockRef.current[product][size] - 1 } }
    stockRef.current = next
    setStock(next)
    return true
  }, [])

  const replace = useCallback((next: Stock) => setStock(sanitize(next)), [])
  const reset = useCallback(() => setStock(zeroStock()), [])

  const value = useMemo(() => ({ stock, quantity, take, replace, reset }), [stock, quantity, take, replace, reset])

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}
