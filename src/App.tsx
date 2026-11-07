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
import { AddressesPage } from './pages/account/AddressesPage'
import { OrderDetailPage } from './pages/account/OrderDetailPage'
import { OrdersPage } from './pages/account/OrdersPage'
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
    case 'orders':
      return titleFor('My Orders')
    case 'order':
      return titleFor('Order Details')
    case 'addresses':
      return titleFor('Saved Addresses')
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
      <CurrentPage route={route} findProduct={catalog.findProduct} onOpenProfile={() => setProfileOpen(true)} />
      <Footer />
      <ProductModal />
      <CartDrawer />
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  )
}
