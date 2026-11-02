import { ROUTES } from '../../constants/routes'
import { useProductModal } from '../../context/productModal/useProductModal'
import type { Product } from '../../types'
import { ProductDetails } from './components/ProductDetails'
import { Recommendations } from './components/Recommendations'
import './ProductPage.css'

/** Direct-link product page (#product-<slug>). Cards elsewhere open the popup instead. */
export function ProductPage({ product }: { product: Product }) {
  const modal = useProductModal()
  return (
    <main className="product-detail-page">
      <div className="product-detail-wrap">
        <a className="product-back-link" href={ROUTES.collection}>
          ← BACK TO COLLECTION
        </a>
        <ProductDetails product={product} />
        <Recommendations product={product} onOpen={modal.open} />
      </div>
    </main>
  )
}
