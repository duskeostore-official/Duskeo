import { Fragment, type CSSProperties } from 'react'
import { ProductCard } from '../../../components/productCard/ProductCard'
import { ProductRail } from '../../../components/productCard/ProductRail'
import { RAIL_SPEEDS, RAIL_STEP_INTERVAL_MS } from '../../../constants/site'
import type { ThemedRail } from '../../../data/searchConfig'
import { useCssNumber } from '../../../hooks/useCssNumber'
import type { Product } from '../../../types'
import { isNewProduct } from '../../../utils/search'

interface ResultsGridProps {
  products: Product[]
  rails: ThemedRail[]
  onOpen: (slug: string) => void
  /** Explore mode: featured 2×2 cards and themed rails. Off = one plain grid. */
  editorial: boolean
}

/** Grid rows per block (before a themed rail), by column count. */
const rowsFor = (cols: number) => (cols <= 2 ? 4 : cols === 3 ? 3 : 2)
/** The featured card spans 2×2 cells, i.e. 3 extra cells. */
const FEATURE_EXTRA_CELLS = 3

/**
 * Editorial results grid:
 * - Each block opens with a large 2×2 featured card, alternating left/right.
 * - Themed, auto-scrolling rails sit between blocks.
 * - Cards fade up one after another whenever the results change.
 * Column count comes from CSS (`--cols`), so blocks always end on a full row.
 */
export function ResultsGrid({ products, rails, onOpen, editorial }: ResultsGridProps) {
  const { ref, value: cols } = useCssNumber<HTMLDivElement>('--cols', 4)
  const blockSize = editorial ? cols * rowsFor(cols) - FEATURE_EXTRA_CELLS : Math.max(products.length, 1)

  const blocks: Product[][] = []
  for (let i = 0; i < products.length; i += blockSize) blocks.push(products.slice(i, i + blockSize))

  // Rails go between blocks; with a single block, one rail follows it.
  const railSlots = editorial ? Math.max(1, blocks.length - 1) : 0
  // Re-keying on the result set replays the entrance animation.
  const signature = products.map((p) => p.slug).join('|')

  return (
    <div className="results" ref={ref}>
      {blocks.map((block, b) => {
        const rail = b < railSlots && rails.length ? rails[b % rails.length] : undefined
        // A partial last block skips the feature so it doesn't leave holes.
        const featured = editorial && block.length === blockSize
        return (
          <Fragment key={`${b}-${signature}`}>
            <div className="results-grid">
              {block.map((p, i) => {
                const isFeature = featured && i === 0
                const classes = ['results-cell', isFeature && 'is-featured', isFeature && b % 2 === 1 && 'is-right']
                return (
                  <div key={p.slug} className={classes.filter(Boolean).join(' ')} style={{ '--i': i } as CSSProperties}>
                    <div className="results-badges">
                      {isNewProduct(p) && <span className="badge-new">NEW</span>}
                      {isFeature && <span className="badge-theme">{p.theme.toUpperCase()}</span>}
                    </div>
                    <ProductCard product={p} onOpen={onOpen} />
                  </div>
                )
              })}
            </div>
            {rail && (
              <section className="results-rail" aria-label={rail.title}>
                <div className="results-rail-head">
                  <span className="eyebrow">{rail.eyebrow}</span>
                  <h2>{rail.title}</h2>
                  <span className="results-rail-count">{rail.products.length} PIECES</span>
                </div>
                <ProductRail
                  products={rail.products}
                  speed={RAIL_SPEEDS[b % 2]}
                  direction={b % 2 === 0 ? 1 : -1}
                  phase={(b % 2) * (RAIL_STEP_INTERVAL_MS / 2)}
                  label={rail.title}
                  onOpen={onOpen}
                />
              </section>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
