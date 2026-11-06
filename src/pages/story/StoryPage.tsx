import { ROUTES } from '../../constants/routes'
import { BRAND_TAGLINE } from '../../constants/site'
import { STORY_MANIFESTO, STORY_VALUES } from '../../data/story'
import './StoryPage.css'

export function StoryPage() {
  return (
    <main id="story-view" className="story-page-main">
      <section className="story-page-hero">
        <div className="story-page-glow" />
        <div className="story-page-botanical story-page-botanical-left" aria-hidden="true">
          <svg viewBox="0 0 260 590" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g className="story-botanical-stems">
              <path d="M-18 578C46 520 64 442 48 366C35 304 62 246 126 202C161 178 174 122 154 44" />
              <path d="M12 590C70 548 105 497 108 438C112 365 86 321 54 281C28 248 14 192 22 126" />
              <path d="M22 82C54 112 76 150 77 194" />
            </g>
            <g className="story-botanical-leaves">
              <path d="M48 367C13 335 7 299 13 272C48 288 65 316 48 367Z" />
              <path d="M56 337C82 299 109 289 132 294C119 326 91 344 56 337Z" />
              <path d="M63 275C28 249 20 218 23 191C57 204 76 231 63 275Z" />
              <path d="M78 231C112 204 140 202 161 212C146 240 116 249 78 231Z" />
              <path d="M106 438C67 426 43 442 27 466C64 478 91 465 106 438Z" />
              <path d="M108 470C144 448 173 452 193 469C174 493 140 499 108 470Z" />
              <path d="M70 516C42 493 17 500 2 518C28 541 52 537 70 516Z" />
              <path d="M22 126C-3 101-5 70 5 48C31 63 40 94 22 126Z" />
              <path d="M153 45C124 25 119 0 126-18C153-10 168 12 153 45Z" />
            </g>
            <g className="story-botanical-bloom story-botanical-bloom-one">
              <ellipse cx="132" cy="194" rx="9" ry="25" />
              <ellipse cx="132" cy="194" rx="9" ry="25" transform="rotate(72 132 194)" />
              <ellipse cx="132" cy="194" rx="9" ry="25" transform="rotate(144 132 194)" />
              <circle cx="132" cy="194" r="7" />
            </g>
            <g className="story-botanical-bloom story-botanical-bloom-two">
              <ellipse cx="27" cy="82" rx="7" ry="19" />
              <ellipse cx="27" cy="82" rx="7" ry="19" transform="rotate(72 27 82)" />
              <ellipse cx="27" cy="82" rx="7" ry="19" transform="rotate(144 27 82)" />
              <circle cx="27" cy="82" r="5" />
            </g>
            <g className="story-botanical-bloom story-botanical-bloom-three">
              <ellipse cx="193" cy="469" rx="8" ry="21" />
              <ellipse cx="193" cy="469" rx="8" ry="21" transform="rotate(72 193 469)" />
              <ellipse cx="193" cy="469" rx="8" ry="21" transform="rotate(144 193 469)" />
              <circle cx="193" cy="469" r="6" />
            </g>
          </svg>
        </div>
        <div className="story-page-botanical story-page-botanical-right" aria-hidden="true">
          <svg viewBox="0 0 260 590" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g className="story-botanical-stems">
              <path d="M-18 578C46 520 64 442 48 366C35 304 62 246 126 202C161 178 174 122 154 44" />
              <path d="M12 590C70 548 105 497 108 438C112 365 86 321 54 281C28 248 14 192 22 126" />
              <path d="M22 82C54 112 76 150 77 194" />
            </g>
            <g className="story-botanical-leaves">
              <path d="M48 367C13 335 7 299 13 272C48 288 65 316 48 367Z" />
              <path d="M56 337C82 299 109 289 132 294C119 326 91 344 56 337Z" />
              <path d="M63 275C28 249 20 218 23 191C57 204 76 231 63 275Z" />
              <path d="M78 231C112 204 140 202 161 212C146 240 116 249 78 231Z" />
              <path d="M106 438C67 426 43 442 27 466C64 478 91 465 106 438Z" />
              <path d="M108 470C144 448 173 452 193 469C174 493 140 499 108 470Z" />
              <path d="M70 516C42 493 17 500 2 518C28 541 52 537 70 516Z" />
              <path d="M22 126C-3 101-5 70 5 48C31 63 40 94 22 126Z" />
              <path d="M153 45C124 25 119 0 126-18C153-10 168 12 153 45Z" />
            </g>
            <g className="story-botanical-bloom story-botanical-bloom-one">
              <ellipse cx="132" cy="194" rx="9" ry="25" />
              <ellipse cx="132" cy="194" rx="9" ry="25" transform="rotate(72 132 194)" />
              <ellipse cx="132" cy="194" rx="9" ry="25" transform="rotate(144 132 194)" />
              <circle cx="132" cy="194" r="7" />
            </g>
            <g className="story-botanical-bloom story-botanical-bloom-two">
              <ellipse cx="27" cy="82" rx="7" ry="19" />
              <ellipse cx="27" cy="82" rx="7" ry="19" transform="rotate(72 27 82)" />
              <ellipse cx="27" cy="82" rx="7" ry="19" transform="rotate(144 27 82)" />
              <circle cx="27" cy="82" r="5" />
            </g>
            <g className="story-botanical-bloom story-botanical-bloom-three">
              <ellipse cx="193" cy="469" rx="8" ry="21" />
              <ellipse cx="193" cy="469" rx="8" ry="21" transform="rotate(72 193 469)" />
              <ellipse cx="193" cy="469" rx="8" ry="21" transform="rotate(144 193 469)" />
              <circle cx="193" cy="469" r="6" />
            </g>
          </svg>
        </div>
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
          <a className="story-page-shop" href={ROUTES.explore}>
            EXPLORE THE COLLECTION <span>→</span>
          </a>
        </div>
      </section>
    </main>
  )
}
