import type { MouseEvent } from 'react'
import { productHref } from '../../data/products'
import type { Product } from '../../types'
import { rupees } from '../../utils/format'
import './ProductCard.css'

interface ProductCardProps {
  product: Product
  /** Opens the product (popup). Without it the card links to the product page. */
  onOpen?: (slug: string) => void
  /** false for the duplicate copies in a looping rail. */
  focusable?: boolean
}

/** Product tile. "ADD TO BAG" also opens the product so a size is always chosen. */
export function ProductCard({ product, onOpen, focusable = true }: ProductCardProps) {
  const href = productHref(product.slug)
  const tabIndex = focusable ? undefined : -1

  const open = (e: MouseEvent) => {
    if (!onOpen) return
    e.preventDefault()
    onOpen(product.slug)
  }

  return (
    <article className="product product-card">
      <a
        className="product-open-link"
        href={href}
        aria-label={`View ${product.name}`}
        draggable={false}
        tabIndex={tabIndex}
        onClick={open}
      >
        <img className="product-photo" src={product.photos[0].src} alt={product.cardAlt} draggable={false} loading="lazy" />
      </a>
      <a className="product-name product-open-name" href={href} draggable={false} tabIndex={tabIndex} onClick={open}>
        {product.name}
      </a>
      <div className="price">{rupees(product.price)}</div>
      <button
        className="add"
        tabIndex={tabIndex}
        onClick={(e) => (onOpen ? open(e) : (window.location.hash = href))}
      >
        ADD TO BAG +
      </button>
    </article>
  )
}
