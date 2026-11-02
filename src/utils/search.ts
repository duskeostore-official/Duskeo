import { SIZES } from '../constants/site'
import { PRODUCTS } from '../data/products'
import { NEW_WINDOW_DAYS, PRICE_RANGES } from '../data/searchConfig'
import type { Product, SearchFilters, Size, SortKey } from '../types'

export interface ScoredProduct {
  product: Product
  score: number
}

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9₹]+/).filter(Boolean)

/**
 * Text search. Each query word must appear somewhere; matches in the name
 * count most, then theme, then the rest of the copy. An empty query
 * returns everything.
 */
export function searchProducts(products: Product[], query: string): ScoredProduct[] {
  const terms = words(query)
  if (!terms.length) return products.map((product) => ({ product, score: 0 }))

  return products
    .map((product) => {
      const name = product.name.toLowerCase()
      const theme = product.theme.toLowerCase()
      const rest = [product.kicker, product.description, ...product.specs.map((s) => s.value)].join(' ').toLowerCase()
      let score = 0
      for (const term of terms) {
        const s = (name.includes(term) ? 3 : 0) + (theme.includes(term) ? 2 : 0) + (rest.includes(term) ? 1 : 0)
        if (!s) return null
        score += s
      }
      return { product, score }
    })
    .filter((r): r is ScoredProduct => r !== null)
}

type QuantityFn = (product: string, size: Size) => number

export function applyFilters(results: ScoredProduct[], filters: SearchFilters, quantity: QuantityFn) {
  const ranges = PRICE_RANGES.filter((r) => filters.prices.includes(r.id))
  return results.filter(({ product: p }) => {
    if (filters.themes.length && !filters.themes.includes(p.theme)) return false
    if (ranges.length && !ranges.some((r) => r.test(p.price))) return false
    if (filters.sizes.length && !filters.sizes.some((s) => quantity(p.name, s) > 0)) return false
    if (filters.inStockOnly && !SIZES.some((s) => quantity(p.name, s) > 0)) return false
    return true
  })
}

export function sortResults(results: ScoredProduct[], sort: SortKey): Product[] {
  // Copy with original index so ties keep catalog order.
  const indexed = results.map((r, i) => ({ ...r, i }))
  const by: Record<SortKey, (a: (typeof indexed)[number], b: (typeof indexed)[number]) => number> = {
    relevance: (a, b) => b.score - a.score || a.i - b.i,
    newest: (a, b) => b.product.launchedAt.localeCompare(a.product.launchedAt) || a.i - b.i,
    'price-asc': (a, b) => a.product.price - b.product.price || a.i - b.i,
    'price-desc': (a, b) => b.product.price - a.product.price || a.i - b.i,
    name: (a, b) => a.product.name.localeCompare(b.product.name),
  }
  return indexed.sort(by[sort]).map((r) => r.product)
}

const DAY_MS = 86_400_000
const newestLaunch = Math.max(...PRODUCTS.map((p) => Date.parse(p.launchedAt)))

/** True for products from the latest drop window (NEW badge). */
export const isNewProduct = (p: Product) => newestLaunch - Date.parse(p.launchedAt) <= NEW_WINDOW_DAYS * DAY_MS

export const activeFilterCount =(f: SearchFilters) =>
  f.themes.length + f.prices.length + f.sizes.length + (f.inStockOnly ? 1 : 0)

/** Adds the value if missing, removes it if present. */
export const toggleIn = <T>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

/** Seeded shuffle — stable for one page load, different on the next. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = [...items]
  let s = seed || 1
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
