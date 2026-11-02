import { ProductCard } from '../../../components/productCard/ProductCard'
import { useInfiniteRail } from '../../../hooks/useInfiniteRail'
import type { Product } from '../../../types'

interface ProductRailProps {
  products: Product[]
  speed: number
  direction: 1 | -1
  /** Step mode: delay before this rail's first step (ms). */
  phase?: number
  label: string
  onOpen: (slug: string) => void
}

/** One endless, draggable row of product cards. */
export function ProductRail({ products, speed, direction, phase, label, onOpen }: ProductRailProps) {
  const { viewportRef, trackRef, copies, viewportProps } = useInfiniteRail({ speed, direction, phase })

  return (
    <div className="rail" ref={viewportRef} role="region" aria-label={label} {...viewportProps}>
      <div className="rail-track" ref={trackRef}>
        {Array.from({ length: copies }, (_, copy) => (
          // Only the first set is exposed to screen readers / keyboard.
          <div className="rail-set" key={copy} aria-hidden={copy > 0 || undefined}>
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} onOpen={onOpen} focusable={copy === 0} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
