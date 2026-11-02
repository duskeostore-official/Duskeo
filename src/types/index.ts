import type { SIZES } from '../constants/site'

export type Size = (typeof SIZES)[number]

export interface ProductPhoto {
  src: string
  label: string
  alt: string
}

export interface ProductSpec {
  label: string
  value: string
}

export interface Product {
  /** Used in the hash route: #product-<slug> */
  slug: string
  name: string
  price: number
  cardAlt: string
  description: string
  kicker: string
  photos: ProductPhoto[]
  specs: ProductSpec[]
  /** Placeholder product (see data/dummyProducts.ts). */
  isDummy?: boolean
}

export interface CartItem {
  name: string
  price: number
  qty: number
}

/** product name -> size -> available quantity */
export type Stock = Record<string, Record<Size, number>>

export interface RestockRequest {
  product: string
  size: Size
  email: string
  requestedAt: string
}

export interface PolicyBlock {
  heading?: string
  /** Paragraph text. `{email}` is replaced with a mailto link. */
  text: string
}

export interface Policy {
  id: string
  navLabel: string
  number: string
  title: string
  blocks: PolicyBlock[]
  showContactCard?: boolean
}

export type Route =
  | { view: 'home'; anchor?: string }
  | { view: 'story' }
  | { view: 'product'; slug: string }
  | { view: 'policy'; policyId: string }
  | { view: 'faq' }
