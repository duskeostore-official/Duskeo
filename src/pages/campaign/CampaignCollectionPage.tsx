import { useEffect, useState } from 'react'
import { ProductCard } from '../../components/productCard/ProductCard'
import { STORE_COLLECTIONS, isStoreCollectionSlug, type StoreCollectionSlug } from '../../data/campaignCollections'
import { useCatalog } from '../../context/catalog/useCatalog'
import { supabase } from '../../lib/supabase'
import './CampaignCollectionPage.css'

interface CollectionProductRow {
  sort_order: number
  products: {
    slug: string
    tags: string[] | null
    attributes: Record<string, string> | null
  } | null
}

const matchesCollection = (collection: StoreCollectionSlug, product: CollectionProductRow['products']) => {
  if (!product) return false
  const theme = product.attributes?.theme?.toLowerCase() ?? ''
  const tags = new Set((product.tags ?? []).map((tag) => tag.toLowerCase()))
  if (collection === 'anime') {
    return theme === 'anime' || ['anime', 'anime-collection'].some((tag) => tags.has(tag))
  }
  if (collection === 'gym') {
    return ['gym', 'fitness'].includes(theme) || ['gym', 'fitness', 'gym-collection'].some((tag) => tags.has(tag))
  }
  if (collection === 'mythology') {
    return ['mythic', 'mythology'].includes(theme) || ['mythic', 'mythology', 'legacy'].some((tag) => tags.has(tag))
  }
  return ['dark', 'darkwear', 'oblivion'].includes(theme) || ['dark', 'darkwear', 'oblivion'].some((tag) => tags.has(tag))
}

export function CampaignCollectionPage({ slug }: { slug: string }) {
  const collectionSlug: StoreCollectionSlug | null = isStoreCollectionSlug(slug) ? slug : null
  const campaign = STORE_COLLECTIONS.find((item) => item.slug === collectionSlug)
  const catalog = useCatalog()
  const [productSlugs, setProductSlugs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    let requestId = 0
    let requestController: AbortController | null = null
    let requestTimeout: number | undefined
    if (!collectionSlug) {
      return () => {
        current = false
      }
    }

    const loadCollection = async () => {
      const currentRequestId = ++requestId
      requestController?.abort()
      if (requestTimeout !== undefined) window.clearTimeout(requestTimeout)
      const controller = new AbortController()
      requestController = controller
      requestTimeout = window.setTimeout(() => controller.abort(), 8000)
      setError('')

      const { data: collection, error: collectionError } = await supabase
        .from('collections')
        .select('id, is_active')
        .eq('slug', collectionSlug)
        .abortSignal(controller.signal)
        .maybeSingle()

      if (!current || currentRequestId !== requestId) return
      if (collectionError) {
        setError('Could not load this collection. Please try again later.')
        setLoading(false)
        return
      }
      if (!collection || !collection.is_active) {
        setLoading(false)
        return
      }

      const { data: rows, error: productsError } = await supabase
        .from('collection_products')
        .select('sort_order, products!inner(slug, tags, attributes)')
        .eq('collection_id', collection.id)
        .order('sort_order')
        .abortSignal(controller.signal)

      if (!current || currentRequestId !== requestId) return
      if (productsError) {
        setError('Could not load products for this collection. Please try again later.')
      } else {
        setProductSlugs(
          ((rows ?? []) as unknown as CollectionProductRow[])
            .flatMap((row) => row.products?.slug ? [row.products.slug] : []),
        )
        setConfigured(true)
      }
      setLoading(false)
      if (requestTimeout !== undefined) window.clearTimeout(requestTimeout)
      requestTimeout = undefined
    }

    const onVisibilityChange = () => {
      if (!document.hidden) void loadCollection()
    }

    void loadCollection()
    window.addEventListener('focus', loadCollection)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      current = false
      requestId += 1
      if (requestTimeout !== undefined) window.clearTimeout(requestTimeout)
      requestController?.abort()
      window.removeEventListener('focus', loadCollection)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [collectionSlug])

  if (!campaign) return <main className="page-loading">COLLECTION NOT AVAILABLE</main>

  const products = productSlugs.flatMap((productSlug) => {
    const product = catalog.products.find((item) => item.slug === productSlug && !item.isDummy)
    return product ? [product] : []
  })
  const fallbackProducts = collectionSlug
    ? catalog.products.filter((product) =>
        !product.isDummy &&
        matchesCollection(collectionSlug, {
          slug: product.slug,
          tags: null,
          attributes: { theme: product.theme },
        }),
      )
    : []
  const displayedProducts = products.length ? products : fallbackProducts

  return (
    <main className="campaign-collection">
      <a className="page-back" href="#top">← BACK TO DUSKEO</a>
      <img
        className="campaign-collection-banner"
        src={campaign.image}
        alt={`${campaign.title} — ${campaign.subtitle}. ${campaign.description}`}
      />
      <section className="campaign-collection-content">
        <p className="page-kicker">DUSKEO / {campaign.subtitle}</p>
        <h1>{campaign.subtitle}</h1>
        {campaign.description && <p className="campaign-collection-description">{campaign.description}</p>}
        {error && <p className="campaign-collection-message" role="alert">{error}</p>}
        {displayedProducts.length ? (
          <div className="campaign-collection-grid">
            {displayedProducts.map((product) => <ProductCard key={product.slug} product={product} />)}
          </div>
        ) : loading ? (
          <p className="campaign-collection-message" role="status">LOADING THE COLLECTION…</p>
        ) : (
          <p className="campaign-collection-message">
            {configured
              ? 'Pieces from this collection are coming soon.'
              : 'This collection is being prepared. Please check back soon.'}
          </p>
        )}
        <a className="campaign-collection-back" href="#collection">VIEW ALL DUSKEO PRODUCTS →</a>
      </section>
    </main>
  )
}
