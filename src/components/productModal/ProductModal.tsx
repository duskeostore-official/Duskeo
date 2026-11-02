import { useEffect, useRef } from 'react'
import { useProductModal } from '../../context/productModal/useProductModal'
import { ProductDetails } from '../../pages/product/components/ProductDetails'
import { Recommendations } from '../../pages/product/components/Recommendations'
import './ProductModal.css'

/** Full-screen product popup with a back-stack of opened products. */
export function ProductModal() {
  const { stack, transition, closing, push, back, close } = useProductModal()
  const panelRef = useRef<HTMLDivElement>(null)
  const current = stack[stack.length - 1]
  const depth = stack.length
  const isOpen = depth > 0

  // Lock page scroll behind the popup.
  useEffect(() => {
    if (!isOpen) return
    const html = document.documentElement
    const previous = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = previous
    }
  }, [isOpen])

  // Esc closes.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  // Each new item starts at the top, with focus inside the popup.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    panel.scrollTo({ top: 0 })
    panel.focus({ preventScroll: true })
  }, [current?.slug, depth])

  if (!current) return null

  const previous = stack[depth - 2]

  return (
    <div
      className={`pmodal${closing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={current.name}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="pmodal-panel" ref={panelRef} tabIndex={-1}>
        <div className="pmodal-bar">
          <button
            className="pmodal-back"
            onClick={back}
            aria-label={previous ? `Back to ${previous.name}` : 'Close product'}
          >
            ← BACK
          </button>

          <ol className="pmodal-trail" aria-label="Viewed products">
            {stack.map((p, i) => (
              <li key={`${i}-${p.slug}`} aria-current={i === depth - 1 ? 'step' : undefined}>
                {p.name}
              </li>
            ))}
          </ol>
          <span className="pmodal-dots" aria-hidden="true">
            {stack.map((p, i) => (
              <i key={`${i}-${p.slug}`} className={i === depth - 1 ? 'is-current' : undefined} />
            ))}
          </span>

          <button className="pmodal-close" onClick={close} aria-label="Close">
            ×
          </button>
        </div>

        {/* Keyed so each item re-mounts: fresh size selection + slide-in animation. */}
        <div key={`${depth}-${current.slug}`} className={`pmodal-content from-${transition}`}>
          <ProductDetails product={current} showCollectionLink={false} />
          <Recommendations product={current} onOpen={push} />
        </div>
      </div>
    </div>
  )
}
