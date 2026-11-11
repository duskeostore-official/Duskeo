/** Hash routes, kept identical to the original site so old links still work. */
export const ROUTES = {
  home: '#home',
  top: '#top',
  women: '#women',
  collection: '#collection',
  footer: '#footer',
  ourStory: '#our-story',
  faq: '#faq',
  customDesign: '#custom-design',
  /** Plain search (header icon, VIEW ALL). */
  search: '#search',
  /** Themed, editorial version of the search page (EXPLORE THE COLLECTION). */
  explore: '#explore',
  admin: '#admin',
  policyPrefix: '#policy-',
  /** Signed-in customer pages */
  orders: '#orders',
  orderPrefix: '#order-',
  addresses: '#addresses',
  collectionPrefix: '#collection-',
} as const

export const orderHref = (id: number) => `${ROUTES.orderPrefix}${id}`

/** In-page anchors on the home view. */
export const HOME_ANCHORS = ['collection', 'story', 'reviews', 'footer'] as const
