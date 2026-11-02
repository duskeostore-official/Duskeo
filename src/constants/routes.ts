/** Hash routes, kept identical to the original site so old links still work. */
export const ROUTES = {
  home: '#home',
  top: '#top',
  collection: '#collection',
  footer: '#footer',
  ourStory: '#our-story',
  faq: '#faq',
  admin: '#admin',
  policyPrefix: '#policy-',
} as const

/** In-page anchors on the home view. */
export const HOME_ANCHORS = ['collection', 'story', 'reviews', 'footer'] as const
