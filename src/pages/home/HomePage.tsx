import { BrandStory } from './sections/BrandStory'
import { Collection } from './sections/Collection'
import { Hero } from './sections/Hero'
import { Reviews } from './sections/Reviews'

export function HomePage() {
  return (
    <main id="home-view">
      <Hero />
      <Collection />
      <BrandStory />
      <Reviews />
    </main>
  )
}
