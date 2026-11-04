import { ROUTES } from '../../../constants/routes'
import { RAIL_SPEEDS, RAIL_STEP_INTERVAL_MS } from '../../../constants/site'
import { useProductModal } from '../../../context/productModal/useProductModal'
import { useCatalog } from '../../../context/catalog/useCatalog'
import { ProductRail } from '../../../components/productCard/ProductRail'
import './Collection.css'

export function Collection() {
  const modal = useProductModal()
  const { products } = useCatalog()
  const rowOne = products.filter((_, i) => i % 2 === 0)
  const rowTwo = products.filter((_, i) => i % 2 === 1)

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
          products={rowOne}
          speed={RAIL_SPEEDS[0]}
          direction={1}
          label="Collection, row 1"
          onOpen={modal.open}
        />
        {rowTwo.length > 0 && (
          <ProductRail
            products={rowTwo}
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
