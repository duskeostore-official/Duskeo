import { useCallback, useEffect, useMemo, useState } from 'react'
import { ROUTES } from '../constants/routes'
import { findProduct } from '../data/products'
import { POLICIES } from '../data/policies'
import type { Route } from '../types'

const currentHash = () => window.location.hash

/** Maps a location hash to the view it should show (same rules as the original site). */
export function parseRoute(hash: string): Route {
  const lower = hash.toLowerCase()
  if (lower === ROUTES.ourStory) return { view: 'story' }
  if (lower === ROUTES.faq) return { view: 'faq' }
  if (lower.startsWith('#product-')) {
    const slug = lower.slice('#product-'.length)
    if (findProduct(slug)) return { view: 'product', slug }
  }
  if (lower.startsWith(ROUTES.policyPrefix)) {
    const id = lower.slice(1)
    return { view: 'policy', policyId: POLICIES.some((p) => p.id === id) ? id : POLICIES[0].id }
  }
  const anchor = hash.slice(1)
  const isPlain = !anchor || [ROUTES.home, ROUTES.top, ROUTES.admin].includes(lower as never)
  return { view: 'home', anchor: isPlain ? undefined : anchor }
}

export function useHashRoute() {
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

  const route = useMemo(() => parseRoute(hash), [hash])

  return { hash, route, navigate, clearHash }
}
