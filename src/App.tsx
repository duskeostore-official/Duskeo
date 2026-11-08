import { lazy, Suspense, useEffect, useState } from 'react'
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
import { CAMPAIGN_COLLECTIONS } from './data/campaignCollections'
import { POLICIES } from './data/policies'
import { useHashRoute } from './hooks/useHashRoute'
import { HomePage } from './pages/home/HomePage'
import type { Product, Route } from './types'

const AddressesPage = lazy(() => import('./pages/account/AddressesPage').then((module) => ({ default: module.AddressesPage })))
const CampaignPage = lazy(() => import('./pages/campaign/CampaignPage').then((module) => ({ default: module.CampaignPage })))
const CampaignCollectionPage = lazy(() => import('./pages/campaign/CampaignCollectionPage').then((module) => ({ default: module.CampaignCollectionPage })))
const OrderDetailPage = lazy(() => import('./pages/account/OrderDetailPage').then((module) => ({ default: module.OrderDetailPage })))
const OrdersPage = lazy(() => import('./pages/account/OrdersPage').then((module) => ({ default: module.OrdersPage })))
const FaqPage = lazy(() => import('./pages/faq/FaqPage').then((module) => ({ default: module.FaqPage })))
const PoliciesPage = lazy(() => import('./pages/policies/PoliciesPage').then((module) => ({ default: module.PoliciesPage })))
const ProductPage = lazy(() => import('./pages/product/ProductPage').then((module) => ({ default: module.ProductPage })))
const SearchPage = lazy(() => import('./pages/search/SearchPage').then((module) => ({ default: module.SearchPage })))
const StoryPage = lazy(() => import('./pages/story/StoryPage').then((module) => ({ default: module.StoryPage })))

function pageTitle(route: Route, findProduct: (slug: string) => { name: string } | undefined) {
  switch (route.view) {
    case 'story':
      return titleFor('Our Story')
    case 'faq':
      return titleFor('FAQ')
    case 'orders':
      return titleFor('My Orders')
    case 'order':
      return titleFor('Order Details')
    case 'addresses':
      return titleFor('Saved Addresses')
    case 'collection':
      return titleFor(CAMPAIGN_COLLECTIONS.find((collection) => collection.slug === route.slug)?.subtitle ?? 'Collection')
    case 'search':
      if (route.mode === 'explore') return titleFor('Explore the Collection')
      return titleFor(route.query ? `Search: ${route.query}` : 'Search')
    case 'product':
      return titleFor(findProduct(route.slug)!.name)
    case 'policy':
      return titleFor(POLICIES.find((p) => p.id === route.policyId)?.navLabel ?? 'Policies')
    case 'campaign':
      return titleFor('Campaign')
    default:
      return DEFAULT_TITLE
  }
}

function CurrentPage({
  route,
  findProduct,
  onOpenProfile,
}: {
  route: Route
  findProduct: (slug: string) => Product | undefined
  onOpenProfile: () => void
}) {
  switch (route.view) {
    case 'story':
      return <StoryPage />
    case 'faq':
      return <FaqPage />
    case 'orders':
      return <OrdersPage onOpenProfile={onOpenProfile} />
    case 'order':
      return <OrderDetailPage key={route.orderId} orderId={route.orderId} onOpenProfile={onOpenProfile} />
    case 'addresses':
      return <AddressesPage onOpenProfile={onOpenProfile} />
    case 'search':
      // Re-mount on real navigation to a new query (typing only replaces the URL).
      return <SearchPage key={`${route.mode}-${route.query}`} initialQuery={route.query} mode={route.mode} />
    case 'product':
      return <ProductPage key={route.slug} product={findProduct(route.slug)!} />
    case 'policy':
      return <PoliciesPage policyId={route.policyId} />
    case 'campaign':
      return <CampaignPage slug={route.slug} />
    case 'collection':
      return <CampaignCollectionPage key={route.slug} slug={route.slug} />
    default:
      return <HomePage />
  }
}

export default function App() {
  const catalog = useCatalog()
  const { hash, route } = useHashRoute(catalog.products)
  const [profileOpen, setProfileOpen] = useState(false)
  const anchor = route.view === 'home' ? route.anchor : undefined
  const isAdminPath =
    window.location.pathname === '/admin' ||
    window.location.pathname === '/admin/' ||
    hash.toLowerCase() === ROUTES.admin

  // Title + scroll position whenever the route changes.
  useEffect(() => {
    if (isAdminPath) {
      document.title = titleFor('Admin')
      return
    }
    document.title = pageTitle(route, catalog.findProduct)
    if (anchor) {
      // The home view may have just mounted, so scroll after it renders.
      requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' }))
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [route, anchor, catalog.findProduct, isAdminPath])

  const closeAdmin = () => {
    window.location.assign('/')
  }

  if (isAdminPath) {
    return (
      <>
        <LogoFilters />
        <AdminGate onClose={closeAdmin} />
      </>
    )
  }

  return (
    <>
      <LogoFilters />
      <Header onOpenProfile={() => setProfileOpen(true)} />
      <Suspense fallback={<main className="page-loading" aria-label="Loading page" />}>
        <CurrentPage route={route} findProduct={catalog.findProduct} onOpenProfile={() => setProfileOpen(true)} />
      </Suspense>
      <Footer />
      <ProductModal />
      <CartDrawer />
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  )
}
