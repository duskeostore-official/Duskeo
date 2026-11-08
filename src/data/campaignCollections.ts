export const CAMPAIGN_COLLECTIONS = [
  {
    campaignKey: 'campaign-2',
    slug: 'gym',
    title: 'LIMITLESS',
    subtitle: 'GYM COLLECTION',
    description: 'PERFORMANCE. DISCIPLINE. PROGRESS.',
    image: '/campaigns/limitless.jpeg',
  },
  {
    campaignKey: 'campaign-3',
    slug: 'mythology',
    title: 'LEGACY',
    subtitle: 'MYTHOLOGY COLLECTION',
    description: 'ROOTED IN LEGENDS.',
    image: '/campaigns/legacy.jpeg',
  },
  {
    campaignKey: 'campaign-4',
    slug: 'dark',
    title: 'OBLIVION',
    subtitle: 'DARK COLLECTION',
    description: 'FOR THOSE WHO MOVE IN SHADOWS.',
    image: '/campaigns/oblivion.jpeg',
  },
] as const

export const STORE_COLLECTIONS = [
  {
    slug: 'anime',
    title: 'ANIME',
    subtitle: 'ANIME COLLECTION',
    description: '',
    image: '/campaigns/anime.jpeg',
  },
  ...CAMPAIGN_COLLECTIONS,
] as const

export type StoreCollectionSlug = (typeof STORE_COLLECTIONS)[number]['slug']

export const isStoreCollectionSlug = (slug: string): slug is StoreCollectionSlug =>
  STORE_COLLECTIONS.some((collection) => collection.slug === slug)

export const collectionHref = (slug: StoreCollectionSlug) => `#collection-${slug}`
