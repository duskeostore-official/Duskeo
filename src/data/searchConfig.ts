import type { Product, ProductTheme, SearchFilters, SortKey } from '../types'

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'newest', label: 'Newest First' },
  { key: 'price-asc', label: 'Price — Low to High' },
  { key: 'price-desc', label: 'Price — High to Low' },
  { key: 'name', label: 'Name A–Z' },
]

export const PRODUCT_THEMES: ProductTheme[] = ['Anime', 'Samurai', 'Mythic']

export const PRICE_RANGES: { id: string; label: string; test: (price: number) => boolean }[] = [
  { id: 'under-700', label: 'Under ₹700', test: (p) => p < 700 },
  { id: '700-849', label: '₹700 – ₹849', test: (p) => p >= 700 && p < 850 },
  { id: '850-plus', label: '₹850 & above', test: (p) => p >= 850 },
]

/** "Shop by mood" tiles on the search page — one per theme. */
export const THEME_MOODS: Record<ProductTheme, { symbol: string; tagline: string }> = {
  Anime: { symbol: '✳', tagline: 'Relentless energy, bold ink' },
  Samurai: { symbol: '◇', tagline: 'Discipline under a crimson moon' },
  Mythic: { symbol: '✦', tagline: 'Legends written in the clouds' },
}

/** Products launched within this many days of the newest drop get a NEW badge. */
export const NEW_WINDOW_DAYS = 21

export const POPULAR_SEARCHES =['Anime', 'Samurai', 'Mythic', 'Ronin', 'Oversized', 'Moon']

export const EMPTY_FILTERS: SearchFilters = { themes: [], prices: [], sizes: [], inStockOnly: false }

/** Themed, auto-scrolling rows placed between rows of search results. */
export interface SearchRail {
  id: string
  eyebrow: string
  title: string
  match: (p: Product) => boolean
}

export const SEARCH_RAILS: SearchRail[] = [
  { id: 'anime', eyebrow: 'THEME / ANIME', title: 'ANIME ENERGY', match: (p) => p.theme === 'Anime' },
  { id: 'samurai', eyebrow: 'THEME / SAMURAI', title: 'WAY OF THE RONIN', match: (p) => p.theme === 'Samurai' },
  { id: 'mythic', eyebrow: 'THEME / MYTHIC', title: 'MYTHIC SKIES', match: (p) => p.theme === 'Mythic' },
  { id: 'value', eyebrow: 'PRICE EDIT', title: 'UNDER ₹800', match: (p) => p.price < 800 },
]

/** A rail with its products resolved. */
export interface ThemedRail extends SearchRail {
  products: Product[]
}

/** Minimum products for a themed rail to be worth showing. */
export const MIN_RAIL_ITEMS = 3
