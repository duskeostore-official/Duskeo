import { ROUTES } from '../../../constants/routes'
import { REVIEW_CARDS } from '../../../data/reviews'
import './Reviews.css'

export function Reviews() {
  return (
    <section className="reviews" id="reviews" aria-labelledby="reviews-title">
      <div className="reviews-head">
        <div>
          <div className="eyebrow">THE COMMUNITY</div>
          <h2 id="reviews-title">YOUR VOICE. OUR NEXT CHAPTER.</h2>
          <p>Every first drop starts somewhere. Customer reviews will appear here as the DUSKEO community grows.</p>
        </div>
        <a className="reviews-link" href={ROUTES.footer}>
          FOLLOW THE JOURNEY ↗
        </a>
      </div>
      <div className="review-grid">
        {REVIEW_CARDS.map((card) => (
          <article className="review-card" key={card.mark}>
            <span className="review-mark">{card.mark}</span>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
            <span className="review-status">{card.status}</span>
          </article>
        ))}
      </div>
    </section>
  )
}
