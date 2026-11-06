import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { QuickAddSheet } from '../../components/quickAdd/QuickAddSheet'
import type { Product } from '../../types'
import { QuickAddContext } from './quickAddContext'

/** One shared size picker for every product card. */
export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [product, setProduct] = useState<Product | null>(null)
  const [open, setOpen] = useState(false)

  const show = useCallback((next: Product) => {
    setProduct(next)
    // Two frames: the new sheet paints closed first, so it slides up instead of popping in.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => setOpen(true)))
  }, [])
  const close = useCallback(() => setOpen(false), [])

  const value = useMemo(() => ({ open: show }), [show])

  return (
    <QuickAddContext.Provider value={value}>
      {children}
      {/* key: a fresh picker (size, status) for each product */}
      {product && <QuickAddSheet key={product.slug} product={product} open={open} onClose={close} />}
    </QuickAddContext.Provider>
  )
}
