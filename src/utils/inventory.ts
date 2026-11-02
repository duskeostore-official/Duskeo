import { SIZES } from '../constants/site'
import { PRODUCTS } from '../data/products'
import type { Size, Stock } from '../types'

const productNames = PRODUCTS.map((p) => p.name)

/** Start at zero so the site never claims stock that was not entered. */
export const zeroStock = (): Stock =>
  Object.fromEntries(
    productNames.map((p) => [p, Object.fromEntries(SIZES.map((s) => [s, 0])) as Record<Size, number>]),
  )

/** Coerces stored/entered values into whole, non-negative quantities. */
export const sanitizeStock = (raw: Partial<Stock> | null): Stock => {
  const stock = zeroStock()
  productNames.forEach((p) =>
    SIZES.forEach((s) => {
      const v = Number(raw?.[p]?.[s])
      stock[p][s] = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
    }),
  )
  return stock
}
