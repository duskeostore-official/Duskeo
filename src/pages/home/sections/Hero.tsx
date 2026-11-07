import heroImage from '../../../assets/images/home/hero-campaign.webp'
import { ROUTES } from '../../../constants/routes'
import { BRAND_TAGLINE } from '../../../constants/site'
import { useEffect, useState } from 'react'
import { loadStorefrontContent } from '../../../lib/storefront'
import './Hero.css'

export function Hero() {
  const [wallpaper, setWallpaper] = useState(heroImage)
  const [eyebrow, setEyebrow] = useState('THE NEXT CHAPTER')
  const [title, setTitle] = useState('BEYOND\nORDINARY.')
  useEffect(() => {
    void loadStorefrontContent().then(({ data }) => {
      const hero = data.find((item) => item.key === 'hero')
      if (hero?.image_url) setWallpaper(hero.image_url)
      if (hero?.eyebrow) setEyebrow(hero.eyebrow)
      if (hero?.title) setTitle(hero.title.replace(/\\n/g, '\n'))
    })
  }, [])
  return (
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title.split('\n').map((line, index) => <span key={index}>{index > 0 && <br />}{line}</span>)}</h1>
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
        <img src={wallpaper} alt="DUSKEO campaign model beside glowing ivory spire" fetchPriority="high" decoding="async" />
      </div>
    </section>
  )
}
