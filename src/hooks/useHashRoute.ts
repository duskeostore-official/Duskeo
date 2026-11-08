import { useCallback, useEffect, useMemo, useState } from 'react'
import { ROUTES } from '../constants/routes'
import { findProduct } from '../data/products'
import { isStoreCollectionSlug } from '../data/campaignCollections'
import { POLICIES } from '../data/policies'
import type { Product, Route, SearchMode } from '../types'

const currentHash = () => window.location.hash

/** Maps a location hash to the view it should show (same rules as the original site). */
export function parseRoute(hash: string, products: Product[] = []): Route {
  const lower = hash.toLowerCase()
  if (lower === ROUTES.ourStory) return { view: 'story' }
  if (lower === ROUTES.faq) return { view: 'faq' }
  if (lower === ROUTES.orders) return { view: 'orders' }
  if (lower === ROUTES.addresses) return { view: 'addresses' }
  if (lower.startsWith(ROUTES.collectionPrefix)) {
    const slug = lower.slice(ROUTES.collectionPrefix.length)
    if (isStoreCollectionSlug(slug)) return { view: 'collection', slug }
  }
  if (lower.startsWith(ROUTES.orderPrefix)) {
    const orderId = Number(lower.slice(ROUTES.orderPrefix.length))
    if (Number.isInteger(orderId) && orderId > 0) return { view: 'order', orderId }
  }
  for (const mode of ['search', 'explore'] as const) {
    const base = ROUTES[mode]
    if (lower === base || lower.startsWith(base + '?')) {
      const params = new URLSearchParams(hash.slice(base.length + 1))
      return { view: 'search', query: params.get('q') ?? '', mode }
    }
  }
  if (lower.startsWith('#product-')) {
    const slug = lower.slice('#product-'.length)
    if (products.length ? products.some((product) => product.slug === slug) : findProduct(slug)) return { view: 'product', slug }
  }
  if (lower.startsWith('#campaign-')) {
    return { view: 'campaign', slug: lower.slice('#campaign-'.length) }
  }
  if (lower.startsWith(ROUTES.policyPrefix)) {
    const id = lower.slice(1)
    return { view: 'policy', policyId: POLICIES.some((p) => p.id === id) ? id : POLICIES[0].id }
  }
  const anchor = hash.slice(1)
  const isPlain = !anchor || [ROUTES.home, ROUTES.top, ROUTES.admin].includes(lower as never)
  return { view: 'home', anchor: isPlain ? undefined : anchor }
}

/** Hash for the search page (plain or explore mode), optionally with a query. */
export const searchHref = (query = '', mode: SearchMode = 'search') =>
  query.trim() ? `${ROUTES[mode]}?${new URLSearchParams({ q: query.trim() })}` : ROUTES[mode]

export function useHashRoute(products: Product[] = []) {
  const [hash, setHash] = useState(currentHash)

  useEffect(() => {
    const sync = () => setHash(currentHash())
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [])

  /** Go to a hash route (adds a history entry). */
  const navigate = useCallback((href: string) => {
    if (window.location.hash === href) return
    window.location.hash = href
  }, [])

  /** Drop the hash without a new history entry (used when closing admin). */
  const clearHash = useCallback(() => {
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setHash('')
  }, [])

  const route = useMemo(() => parseRoute(hash, products), [hash, products])

  return { hash, route, navigate, clearHash }
}
