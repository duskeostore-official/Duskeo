import { ROUTES } from '../../../constants/routes'
import { RAIL_SPEEDS, RAIL_STEP_INTERVAL_MS } from '../../../constants/site'
import { useProductModal } from '../../../context/productModal/useProductModal'
import { PRODUCTS } from '../../../data/products'
import { ProductRail } from '../../../components/productCard/ProductRail'
import './Collection.css'

// Alternate products between the two rails so both rows mix real + dummy tees.
const ROW_ONE = PRODUCTS.filter((_, i) => i % 2 === 0)
const ROW_TWO = PRODUCTS.filter((_, i) => i % 2 === 1)

export function Collection() {
  const modal = useProductModal()

  return (
    <section className="collection" id="collection">
      <div className="collection-head">
        <div>
          <div className="eyebrow">— {'  '}FEATURED COLLECTION</div>
          <h2>ESSENTIALS</h2>
          <div className="sub">FOR A DIFFERENT TOMORROW</div>
        </div>
        <a className="view" href={ROUTES.search}>
          VIEW ALL {' '}→
        </a>
      </div>
      <div className="products">
        <ProductRail
          products={ROW_ONE}
          speed={RAIL_SPEEDS[0]}
          direction={1}
          label="Collection, row 1"
          onOpen={modal.open}
        />
        {ROW_TWO.length > 0 && (
          <ProductRail
            products={ROW_TWO}
            speed={RAIL_SPEEDS[1]}
            direction={-1}
            phase={RAIL_STEP_INTERVAL_MS / 2}
            label="Collection, row 2"
            onOpen={modal.open}
          />
        )}
      </div>
    </section>
  )
}
