import { useState } from 'react'
import type { Product } from '../../../types'

export function ProductGallery({ product }: { product: Product }) {
  const [active, setActive] = useState(0)
  const main = product.photos[active]

  return (
    <section className="product-detail-gallery" aria-label={`${product.name} photos`}>
      <img className="product-detail-main-photo" src={main.src} alt={`${product.name} ${main.label.toLowerCase()}`} />
      <div className="product-detail-thumbs">
        {product.photos.map((photo, i) => (
          <button
            key={photo.src}
            type="button"
            className={`product-detail-thumb${i === active ? ' is-active' : ''}`}
            aria-label={photo.label}
            onClick={() => setActive(i)}
          >
            <img src={photo.src} alt={photo.alt} />
          </button>
        ))}
      </div>
    </section>
  )
}
