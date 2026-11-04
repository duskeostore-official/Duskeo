import { ProductCard } from '../../../components/productCard/ProductCard'
import type { Product } from '../../../types'
import { getSimilarProducts } from '../../../utils/recommendations'
import { useCatalog } from '../../../context/catalog/useCatalog'
import './Recommendations.css'

interface RecommendationsProps {
  product: Product
  onOpen: (slug: string) => void
}

export function Recommendations({ product, onOpen }: RecommendationsProps) {
  const catalog = useCatalog()
  const similar = getSimilarProducts(product, undefined, catalog.products)
  if (!similar.length) return null

  return (
    <section className="recs" aria-labelledby={`recs-${product.slug}`}>
      <div className="eyebrow">YOU MAY ALSO LIKE</div>
      <h2 id={`recs-${product.slug}`}>SIMILAR PIECES</h2>
      <div className="recs-list">
        {similar.map((p) => (
          <ProductCard key={p.slug} product={p} onOpen={onOpen} />
        ))}
      </div>
    </section>
  )
}
