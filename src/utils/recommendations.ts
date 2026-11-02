import { RECOMMENDATION_COUNT } from '../constants/site'
import { PRODUCTS } from '../data/products'
import type { Product } from '../types'

/**
 * "Similar products": same collection (kicker) first, then the rest,
 * each group starting right after the current product so every
 * product shows a different set.
 */
export function getSimilarProducts(product: Product, count = RECOMMENDATION_COUNT): Product[] {
  const start = PRODUCTS.findIndex((p) => p.slug === product.slug)
  const rotated = [...PRODUCTS.slice(start + 1), ...PRODUCTS.slice(0, Math.max(start, 0))]
  const sameLine = rotated.filter((p) => p.kicker === product.kicker)
  const others = rotated.filter((p) => p.kicker !== product.kicker)
  return [...sameLine, ...others].slice(0, count)
}
