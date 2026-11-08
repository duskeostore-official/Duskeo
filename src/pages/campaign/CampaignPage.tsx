import { useEffect, useState } from 'react'
import { CAMPAIGN_COLLECTIONS, collectionHref } from '../../data/campaignCollections'
import { loadStorefrontContent, type StorefrontContent } from '../../lib/storefront'
import './CampaignPage.css'

export function CampaignPage({ slug }: { slug: string }) {
  const key = `campaign-${slug}`
  const [campaign, setCampaign] = useState<StorefrontContent | null>(null)

  useEffect(() => {
    void loadStorefrontContent().then(({ data }) =>
      setCampaign(data.find((item) => item.key === key && item.active) ?? null),
    )
  }, [key])

  if (!campaign) {
    return <main className="page-loading">CAMPAIGN NOT AVAILABLE</main>
  }
  const collection = CAMPAIGN_COLLECTIONS.find((item) => item.campaignKey === key)
  if (collection) {
    return (
      <main className="campaign-page campaign-page-promo">
        <img
          className="campaign-page-artwork"
          src={collection.image}
          alt={`${collection.title} — ${collection.subtitle}. ${collection.description}`}
        />
        <div className="campaign-page-actions">
          <a className="outline" href={collectionHref(collection.slug)}>SHOP NOW →</a>
          <a className="campaign-page-back" href="#top">BACK TO DUSKEO</a>
        </div>
      </main>
    )
  }

  return (
    <main className="campaign-page">
      <section className="campaign-page-hero" style={campaign.image_url ? { backgroundImage: `url("${campaign.image_url}")` } : undefined}>
        <div>
          <p>{campaign.eyebrow}</p>
          <h1>{campaign.title}</h1>
          {campaign.body && <p>{campaign.body}</p>}
          {campaign.link_url && <a className="outline" href={campaign.link_url}>EXPLORE</a>}
        </div>
      </section>
    </main>
  )
}
