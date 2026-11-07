import { BrandStory } from './sections/BrandStory'
import { Collection } from './sections/Collection'
import { Hero } from './sections/Hero'
import { Reviews } from './sections/Reviews'
import { CampaignSlots } from './sections/CampaignSlots'

export function HomePage() {
  return (
    <main id="home-view">
      <Hero />
      <CampaignSlots />
      <Collection />
      <BrandStory />
      <Reviews />
    </main>
  )
}
