import { useEffect, useState } from 'react'
import { AdminGate } from './components/admin/AdminGate'
import { CartDrawer } from './components/cart/CartDrawer'
import { Footer } from './components/layout/Footer'
import { Header } from './components/layout/Header'
import { ProductModal } from './components/productModal/ProductModal'
import { ProfileDrawer } from './components/profile/ProfileDrawer'
import { LogoFilters } from './components/theme/LogoFilters'
import { ROUTES } from './constants/routes'
import { DEFAULT_TITLE, titleFor } from './constants/site'
import { useCatalog } from './context/catalog/useCatalog'
import { POLICIES } from './data/policies'
import { useHashRoute } from './hooks/useHashRoute'
import { FaqPage } from './pages/faq/FaqPage'
import { HomePage } from './pages/home/HomePage'
import { PoliciesPage } from './pages/policies/PoliciesPage'
import { ProductPage } from './pages/product/ProductPage'
import { SearchPage } from './pages/search/SearchPage'
import { StoryPage } from './pages/story/StoryPage'
import type { Product, Route } from './types'

function pageTitle(route: Route, findProduct: (slug: string) => { name: string } | undefined) {
  switch (route.view) {
    case 'story':
      return titleFor('Our Story')
    case 'faq':
      return titleFor('FAQ')
    case 'search':
      if (route.mode === 'explore') return titleFor('Explore the Collection')
      return titleFor(route.query ? `Search: ${route.query}` : 'Search')
    case 'product':
      return titleFor(findProduct(route.slug)!.name)
    case 'policy':
      return titleFor(POLICIES.find((p) => p.id === route.policyId)?.navLabel ?? 'Policies')
    default:
      return DEFAULT_TITLE
  }
}

function CurrentPage({ route, findProduct }: { route: Route; findProduct: (slug: string) => Product | undefined }) {
  switch (route.view) {
    case 'story':
      return <StoryPage />
    case 'faq':
      return <FaqPage />
    case 'search':
      // Re-mount on real navigation to a new query (typing only replaces the URL).
      return <SearchPage key={`${route.mode}-${route.query}`} initialQuery={route.query} mode={route.mode} />
    case 'product':
      return <ProductPage key={route.slug} product={findProduct(route.slug)!} />
    case 'policy':
      return <PoliciesPage policyId={route.policyId} />
    default:
      return <HomePage />
  }
}

export default function App() {
  const catalog = useCatalog()
  const { hash, route, clearHash } = useHashRoute(catalog.products)
  const [profileOpen, setProfileOpen] = useState(false)
  const anchor = route.view === 'home' ? route.anchor : undefined

  // Title + scroll position whenever the route changes.
  useEffect(() => {
    document.title = pageTitle(route, catalog.findProduct)
    if (anchor) {
      // The home view may have just mounted, so scroll after it renders.
      requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' }))
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [route, anchor, catalog.findProduct])

  return (
    <>
      <LogoFilters />
      <Header onOpenProfile={() => setProfileOpen(true)} />
      <CurrentPage route={route} findProduct={catalog.findProduct} />
      <Footer />
      <ProductModal />
      <CartDrawer />
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
      {hash.toLowerCase() === ROUTES.admin && <AdminGate onClose={clearHash} />}
    </>
  )
}
