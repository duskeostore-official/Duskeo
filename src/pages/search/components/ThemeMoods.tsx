import { CAMPAIGN_COLLECTIONS, collectionHref } from '../../../data/campaignCollections'

/** Collection links styled like the existing image-based mood tiles. */
export function ThemeMoods() {
  return (
    <section className="moods" aria-label="Shop by collection">
      <div className="moods-head">
        <span className="eyebrow">SHOP BY COLLECTION</span>
      </div>
      <div className="moods-list">
        {CAMPAIGN_COLLECTIONS.map((collection) => {
          return (
            <a key={collection.slug} className="mood" href={collectionHref(collection.slug)}>
              <img src={collection.image} alt="" loading="lazy" decoding="async" fetchPriority="low" draggable={false} />
              <span className="mood-text">
                <strong>{collection.title}</strong>
                <small>{collection.subtitle}</small>
              </span>
              <span className="mood-count">
                SHOP NOW →
              </span>
            </a>
          )
        })}
      </div>
    </section>
  )
}
