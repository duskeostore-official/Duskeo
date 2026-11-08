import { useEffect, useState } from 'react'
import { CAMPAIGN_COLLECTIONS, collectionHref } from '../../../data/campaignCollections'
import { loadStorefrontContent, type StorefrontContent } from '../../../lib/storefront'
import './CampaignSlots.css'

export function CampaignSlots() {
  const [slots, setSlots] = useState<StorefrontContent[]>([])
  const [index, setIndex] = useState(0)
  useEffect(() => {
    void loadStorefrontContent().then(({ data }) =>
      setSlots(data.filter((item) => item.key.startsWith('campaign-') && item.active && item.image_url)),
    )
  }, [])
  useEffect(() => {
    if (slots.length < 2) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slots.length)
    }, 6000)
    return () => window.clearInterval(timer)
  }, [slots.length])
  if (!slots.length) return null
  return (
    <section className="campaign-slots" aria-label="Featured campaigns">
      <div className="campaign-slots-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slots.map((slot) => {
          const collection = CAMPAIGN_COLLECTIONS.find((item) => item.campaignKey === slot.key)
          if (!collection) {
            return (
              <a key={slot.key} className="campaign-slot" href={`#${slot.key}`}>
                <img src={slot.image_url} alt={slot.title || 'DUSKEO campaign'} loading="lazy" decoding="async" />
                {(slot.title || slot.eyebrow) && (
                  <div>
                    <span>{slot.eyebrow}</span>
                    <h2>{slot.title}</h2>
                  </div>
                )}
              </a>
            )
          }

          return (
            <article key={slot.key} className="campaign-slot campaign-slot-promo">
              <a className="campaign-slot-artwork" href={`#${slot.key}`} aria-label={`Explore ${collection.title}`}>
                <img src={slot.image_url} alt={`${collection.title} — ${collection.subtitle}. ${collection.description}`} loading="lazy" decoding="async" />
              </a>
              <a className="outline campaign-slot-shop" href={collectionHref(collection.slug)}>
                SHOP NOW →
              </a>
            </article>
          )
        })}
      </div>
      {slots.length > 1 && (
        <div className="campaign-dots" aria-label="Campaign slides">
          {slots.map((slot, dotIndex) => (
            <button
              key={slot.key}
              type="button"
              className={dotIndex === index ? 'active' : ''}
              aria-label={`Show campaign ${dotIndex + 1}`}
              onClick={() => setIndex(dotIndex)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
