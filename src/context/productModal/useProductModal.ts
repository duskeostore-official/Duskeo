import { useContext } from 'react'
import { ProductModalContext } from './productModalContext'

export function useProductModal() {
  const ctx = useContext(ProductModalContext)
  if (!ctx) throw new Error('useProductModal must be used inside <ProductModalProvider>')
  return ctx
}
