import { ROUTES } from '../../constants/routes'
import { BRAND_TAGLINE } from '../../constants/site'
import { STORY_MANIFESTO, STORY_VALUES } from '../../data/story'
import './StoryPage.css'

export function StoryPage() {
  return (
    <main id="story-view" className="story-page-main">
      <section className="story-page-hero">
        <div className="story-page-glow" />
        <div className="story-page-mark">DUSKEO / OUR STORY</div>
        <p className="story-page-kicker">THE STORY BEHIND THE NAME</p>
        <h1>
          BUILT FOR THOSE
          <br />
          <em>WHO MOVE FORWARD.</em>
        </h1>
        <p className="story-page-intro">Not just what you wear. A reflection of who you are becoming.</p>
        <div className="story-page-scroll">
          SCROLL TO DISCOVER <span>↓</span>
        </div>
      </section>

      <section className="story-page-manifesto">
        <div className="story-page-overline">01 — THE BELIEF</div>
        <div className="story-page-manifesto-grid">
          <h2>
            ORDINARY
            <br />
            IS A CHOICE.
            <br />
            <span>SO IS MORE.</span>
          </h2>
          <div className="story-page-copy">
            <p className="story-page-lead">DUSKEO was created around a simple idea: progress is personal.</p>
            {STORY_MANIFESTO.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="story-page-values">
        <div className="story-page-overline">02 — WHAT WE STAND FOR</div>
        <div className="story-page-value-grid">
          {STORY_VALUES.map((value) => (
            <article className="story-page-value" key={value.number}>
              <span>{value.number}</span>
              <div className="story-page-value-symbol">{value.symbol}</div>
              <h2>{value.title}</h2>
              <p>{value.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="story-page-promise">
        <div className="story-page-promise-inner">
          <div className="story-page-overline">03 — THE DUSKEO PROMISE</div>
          <div className="story-page-promise-mark">✦</div>
          <h2>
            BEYOND
            <br />
            ORDINARY.
          </h2>
          <p>Distinctive identity. Considered design. A mindset that keeps moving.</p>
          <div className="story-page-signoff">{BRAND_TAGLINE}</div>
          <a className="story-page-shop" href={ROUTES.collection}>
            EXPLORE THE COLLECTION <span>→</span>
          </a>
        </div>
      </section>
    </main>
  )
}
