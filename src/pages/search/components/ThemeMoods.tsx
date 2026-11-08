import { STORE_COLLECTIONS, collectionHref } from '../../../data/campaignCollections'

/** Collection links styled like the existing image-based mood tiles. */
export function ThemeMoods() {
  return (
    <section className="moods" aria-label="Shop by collection">
      <div className="moods-head">
        <span className="eyebrow">SHOP BY COLLECTION</span>
      </div>
      <div className="moods-list">
        {STORE_COLLECTIONS.map((collection) => {
          return (
            <a
              key={collection.slug}
              className="mood"
              href={collectionHref(collection.slug)}
              aria-label={`Shop ${collection.title} — ${collection.subtitle}`}
            >
              <span className="mood-art">
                <img src={collection.image} alt="" loading="lazy" decoding="async" fetchPriority="low" draggable={false} />
                <span className="mood-image-title">{collection.title}</span>
              </span>
              <span className="mood-caption">
                <small>{collection.subtitle}</small>
                <span>SHOP NOW <span aria-hidden="true">→</span></span>
              </span>
            </a>
          )
        })}
      </div>
    </section>
  )
}
