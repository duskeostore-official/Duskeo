import { useEffect, useState } from 'react'
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
