import { createContext } from 'react'
import type { Product } from '../../types'

/** How the current item arrived — drives the slide direction. */
export type ModalTransition = 'open' | 'push' | 'pop'

export interface ProductModalContextValue {
  /** Products opened in this popup, oldest first; the last one is on screen. */
  stack: Product[]
  transition: ModalTransition
  closing: boolean
  /** Open the popup fresh with one product. */
  open: (slug: string) => void
  /** Show another product on top (e.g. a recommendation). */
  push: (slug: string) => void
  /** Go to the previous product; closes the popup from the first one. */
  back: () => void
  /** Close the popup entirely. */
  close: () => void
}

export const ProductModalContext = createContext<ProductModalContextValue | null>(null)
