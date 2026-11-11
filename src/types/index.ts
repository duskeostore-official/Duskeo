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

export type ProductTheme = 'Anime' | 'Samurai' | 'Mythic'

export interface Product {
  /** Used in the hash route: #product-<slug> */
  slug: string
  name: string
  price: number
  /** Design theme — used by search filters and themed rails. */
  theme: ProductTheme
  /** ISO date, used for "Newest first". */
  launchedAt: string
  cardAlt: string
  description: string
  kicker: string
  photos: ProductPhoto[]
  specs: ProductSpec[]
  /** Placeholder product (see data/dummyProducts.ts). */
  isDummy?: boolean
}

export interface CartItem {
  /** Line label and key, e.g. "LEVI AURA TEE — M" */
  name: string
  product: string
  size: Size
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

/** 'search' = plain results; 'explore' = themed hero, mood tiles, featured cards and rails. */
export type SearchMode = 'search' | 'explore'

export type SortKey ='relevance' | 'newest' | 'price-asc' | 'price-desc' | 'name'

export interface SearchFilters {
  themes: ProductTheme[]
  /** ids from PRICE_RANGES */
  prices: string[]
  /** Only products with stock in at least one of these sizes. */
  sizes: Size[]
  inStockOnly: boolean
}

export type Route =
  | { view: 'home'; anchor?: string }
  | { view: 'women' }
  | { view: 'campaign'; slug: string }
  | { view: 'search'; query: string; mode: SearchMode }
  | { view: 'story' }
  | { view: 'product'; slug: string }
  | { view: 'policy'; policyId: string }
  | { view: 'faq' }
  | { view: 'customDesign' }
  | { view: 'orders' }
  | { view: 'order'; orderId: number }
  | { view: 'checkoutResult'; orderId: number; state: 'success' | 'failed' | 'pending' | 'refunded' }
  | { view: 'addresses' }
  | { view: 'collection'; slug: string }
