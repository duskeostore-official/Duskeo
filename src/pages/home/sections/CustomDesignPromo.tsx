import { ROUTES } from '../../../constants/routes'
import './CustomDesignPromo.css'

export function CustomDesignPromo() {
  return (
    <section className="custom-design-promo" aria-labelledby="custom-design-promo-title">
      <div>
        <span className="custom-design-kicker">MADE YOUR WAY</span>
        <h2 id="custom-design-promo-title">HAVE A DESIGN IN MIND?</h2>
        <p>Tell us what you’re imagining. We’ll review your idea and get back to you about the next steps.</p>
      </div>
      <a className="outline" href={ROUTES.customDesign}>ORDER YOUR CUSTOM DESIGN →</a>
    </section>
  )
}
