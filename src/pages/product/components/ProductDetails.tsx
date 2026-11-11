import { useEffect, useRef, useState } from 'react'
import { ROUTES } from '../../../constants/routes'
import { ADDED_FEEDBACK_MS } from '../../../constants/site'
import { useCart } from '../../../context/cart/useCart'
import { useInventory } from '../../../context/inventory/useInventory'
import { CARE_CONFIRM_NOTE, CARE_INSTRUCTIONS, PRODUCT_FOOTNOTE } from '../../../data/sizeGuide'
import type { Product, Size } from '../../../types'
import { rupees } from '../../../utils/format'
import { NotifyStockForm } from './NotifyStockForm'
import { ProductGallery } from './ProductGallery'
import { SizeGuide } from './SizeGuide'
import { SizeSelector } from './SizeSelector'
import './ProductDetails.css'

interface ProductDetailsProps {
  product: Product
  /** "Back to the collection" link — hidden in the popup, which has its own back button. */
  showCollectionLink?: boolean
}

/** Gallery + full product info. Used by the product page and the product popup. */
export function ProductDetails({ product, showCollectionLink = true }: ProductDetailsProps) {
  const [size, setSize] = useState<Size>('S')
  const [justAdded, setJustAdded] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const cart = useCart()
  const inventory = useInventory()

  const qty = inventory.quantity(product.name, size)
  const soldOut = qty < 1
  const lowStock = qty > 0 && qty < 5

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const addToBag = () => {
    if (!cart.canAdd(product.name, size)) return
    cart.add(product.name, size, product.price)
    setJustAdded(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setJustAdded(false), ADDED_FEEDBACK_MS)
  }

  const addLabel = soldOut ? 'SOLD OUT' : justAdded ? 'ADDED ✓' : 'ADD TO BAG +'

  return (
    <div className="product-detail-grid">
      <ProductGallery product={product} />

      <section className="product-detail-info">
        <p className="product-detail-kicker">{product.kicker}</p>
        <h1>{product.name}</h1>
        <p className="product-detail-price">{rupees(product.price)}</p>
        <p className="product-detail-description">{product.description}</p>

        {product.specs.map((spec, i) => (
          <div className="product-detail-meta" key={i}>
            <span>{spec.label}</span>
            <strong>{spec.value}</strong>
          </div>
        ))}

        <SizeSelector selected={size} onSelect={setSize} isAvailable={(s) => inventory.quantity(product.name, s) > 0} />
        <p className="product-size-note">Selected size: {size}</p>
        <p className={`product-stock-status${lowStock ? ' is-low-stock' : ''}`} aria-live="polite">
          {soldOut ? `SOLD OUT — ${size}` : lowStock ? `ONLY ${qty} LEFT IN SIZE ${size}` : `${qty} IN STOCK`}
        </p>

        <SizeGuide />

        <button className="add product-detail-add" disabled={soldOut} onClick={addToBag}>
          {addLabel}
        </button>
        <NotifyStockForm product={product.name} size={size} visible={soldOut} />

        <div className="duskeo-care-block">
          <h3>CARE INSTRUCTIONS</h3>
          <p>{CARE_INSTRUCTIONS}</p>
          <p className="duskeo-confirm-note">{CARE_CONFIRM_NOTE}</p>
        </div>
        {showCollectionLink && (
          <div className="duskeo-related">
            <h3>EXPLORE MORE</h3>
            <a href={ROUTES.collection}>BACK TO THE DUSKEO COLLECTION →</a>
          </div>
        )}
        <p className="product-detail-footnote">{PRODUCT_FOOTNOTE}</p>
      </section>
    </div>
  )
}
