import { BrandStory } from './sections/BrandStory'
import { Collection } from './sections/Collection'
import { CustomDesignPromo } from './sections/CustomDesignPromo'
import { Hero } from './sections/Hero'
import { Reviews } from './sections/Reviews'

export function HomePage() {
  return (
    <main id="home-view">
      <Hero />
      <Collection />
      <CustomDesignPromo />
      <BrandStory />
      <Reviews />
    </main>
  )
}
