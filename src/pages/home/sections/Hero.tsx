import heroImage from '../../../assets/images/home/hero-campaign.webp'
import { ROUTES } from '../../../constants/routes'
import { BRAND_TAGLINE } from '../../../constants/site'
import './Hero.css'

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">THE NEXT CHAPTER</div>
        <h1>
          BEYOND
          <br />
          ORDINARY.
        </h1>
        <div className="rule" />
        <p className="tagline">{BRAND_TAGLINE}</p>
        <a className="outline" href={ROUTES.explore}>
          EXPLORE THE COLLECTION {' '}→
        </a>
        <div className="hero-note">
          PREMIUM ESSENTIALS {'  '}| {'  '}LIMITED DROPS {'  '}| {'  '}BUILT DIFFERENT
        </div>
      </div>
      <div className="hero-art">
        <img src={heroImage} alt="DUSKEO campaign model beside glowing ivory spire" fetchPriority="high" decoding="async" />
      </div>
    </section>
  )
}
