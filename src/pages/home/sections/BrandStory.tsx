import logo from '../../../assets/images/brand/logo.webp'
import storyBg from '../../../assets/images/home/story-bg.webp'
import { ROUTES } from '../../../constants/routes'
import './BrandStory.css'

export function BrandStory() {
  return (
    <section className="story" id="story">
      <img className="story-bg" src={storyBg} alt="" />
      <div className="story-inner">
        <img className="story-logo" src={logo} alt="DUSKEO official logo" loading="lazy" decoding="async" />
        <h2>A MINDSET BEYOND FASHION.</h2>
        <p>DUSKEO is more than clothing. It's a movement for those who choose progress, purpose and individuality.</p>
        <a className="outline story-page-link" href={ROUTES.ourStory}>
          OUR STORY{'  '}→
        </a>
      </div>
    </section>
  )
}
