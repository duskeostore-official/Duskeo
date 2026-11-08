export const BRAND_NAME = 'DUSKEO'
export const BRAND_TAGLINE = 'WEAR PROGRESS. REPEAT.'
export const CONTACT_EMAIL = 'duskeo@duskeo.store'
/** Order "Help & support" emails go here (VITE_SUPPORT_EMAIL in .env). */
export const SUPPORT_EMAIL: string = import.meta.env.VITE_SUPPORT_EMAIL || CONTACT_EMAIL
export const INSTAGRAM_URL = 'https://www.instagram.com/duskeo.store/'
export const INSTAGRAM_HANDLE = '@duskeo.store'

export const DEFAULT_TITLE = 'DUSKEO — Beyond Ordinary'
export const titleFor = (page: string) => `${page} — DUSKEO`

/** Show placeholder tees from data/dummyProducts.ts during development previews. */
export const SHOW_DUMMY_PRODUCTS = false

/** Collection rails: auto-drift speed in px/second for each row. */
export const RAIL_SPEEDS = [32, 24] as const
/** Pause after the shopper drags/scrolls a rail before it drifts again. */
export const RAIL_RESUME_DELAY_MS = 1400
/** Screens matching this show one card at a time and step instead of drifting. */
export const RAIL_STEP_QUERY = '(max-width: 700px)'
/** Step mode (mobile): time each card stays still before moving to the next. */
export const RAIL_STEP_INTERVAL_MS = 3000
/** Step mode (mobile): how long the move to the next card takes. */
export const RAIL_STEP_DURATION_MS = 2000

/** Number of "similar pieces" shown under a product. */
export const RECOMMENDATION_COUNT = 6
/** Popup close animation length (keep in sync with ProductModal.css). */
export const MODAL_CLOSE_MS = 260

export const SIZES =['S', 'M', 'L', 'XL', 'XXL'] as const

/** How long the "ADDED ✓" label stays on a button. */
export const ADDED_FEEDBACK_MS = 900
export const ADMIN_PASSCODE_MIN_LENGTH = 8
