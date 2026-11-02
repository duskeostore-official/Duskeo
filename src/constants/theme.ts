/**
 * DUSKEO design tokens.
 *
 * Every color used by the site lives here. Each key becomes a CSS variable
 * on <html> (e.g. `bgHeader` -> `--c-bg-header`), and all stylesheets read
 * those variables. To restyle the site, edit a palette below or add a new
 * one to THEMES — no CSS changes needed.
 *
 * `*Rgb` tokens are "r, g, b" triplets used inside rgba(), e.g.
 * `rgba(var(--c-bg-rgb), .8)`, so gradients and overlays follow the theme.
 */

export interface ThemePalette {
  /* Backgrounds */
  bg: string
  bgHeader: string
  bgElevated: string
  bgSection: string
  bgSurface: string
  bgMedia: string
  bgInput: string

  /* Text */
  text: string
  textStrong: string
  textSoft: string
  textDim: string
  textBody: string
  muted: string
  subtle: string
  faint: string
  /** Text placed directly on top of photography (always light). */
  textOnImage: string

  /* Borders & lines */
  borderHeader: string
  line: string
  border: string
  borderStrong: string
  borderInput: string
  borderMuted: string

  /* Inverted surfaces: solid buttons, selected sizes, badges, table heads */
  inverse: string
  onInverse: string

  /* RGB triplets for rgba() */
  bgRgb: string
  shadeRgb: string
  sheenRgb: string
  glowRgb: string

  /* Image treatments */
  /** CSS filter for the header logo — pick from LOGO_FILTERS. */
  logoFilter: string
}

/** ids of the SVG filters defined in components/theme/LogoFilters.tsx */
export const LOGO_FILTER_IDS = {
  pitchBlack: 'duskeo-logo-pitch-black',
} as const

/** Ready-made logo treatments to use as a palette's `logoFilter`. */
export const LOGO_FILTERS = {
  /** Original ivory logo. */
  original: 'none',
  /** Pure black, shadows removed — crisp on light backgrounds. */
  pitchBlack: `url(#${LOGO_FILTER_IDS.pitchBlack})`,
  /** Pure black silhouette of everything, shadows included. */
  silhouette: 'brightness(0)',
} as const

/** Original DUSKEO look — matches the source HTML. */
const dark: ThemePalette = {
  bg: '#030303',
  bgHeader: '#020202',
  bgElevated: '#050505',
  bgSection: '#070707',
  bgSurface: '#090909',
  bgMedia: '#080808',
  bgInput: '#111111',

  text: '#eee9df',
  textStrong: '#f0ede5',
  textSoft: '#d8d1c4',
  textDim: '#c7c1b7',
  textBody: '#bdb6ab',
  muted: '#aaa49a',
  subtle: '#8f887d',
  faint: '#817b72',
  textOnImage: '#f0ede5',

  borderHeader: '#171717',
  line: '#242321',
  border: '#292724',
  borderStrong: '#393631',
  borderInput: '#4a4740',
  borderMuted: '#9d978b',

  inverse: '#eee9df',
  onInverse: '#090909',

  bgRgb: '3, 3, 3',
  shadeRgb: '0, 0, 0',
  sheenRgb: '255, 255, 255',
  glowRgb: '210, 198, 172',

  logoFilter: LOGO_FILTERS.original,
}

/** Optional light variant, ready for a future one-click toggle. */
const light: ThemePalette = {
  bg: '#f6f3ec',
  bgHeader: '#faf8f3',
  bgElevated: '#f3efe6',
  bgSection: '#efeae0',
  bgSurface: '#fbf9f4',
  bgMedia: '#ebe6db',
  bgInput: '#ffffff',

  text: '#1a1814',
  textStrong: '#0e0d0b',
  textSoft: '#2e2a24',
  textDim: '#4a453d',
  textBody: '#57514a',
  muted: '#6b655c',
  subtle: '#857e73',
  faint: '#9a9388',
  textOnImage: '#f6f3ec',

  borderHeader: '#e4ded2',
  line: '#ddd6c9',
  border: '#d6cfc2',
  borderStrong: '#c4bcad',
  borderInput: '#b0a899',
  borderMuted: '#8f887d',

  inverse: '#1a1814',
  onInverse: '#f6f3ec',

  bgRgb: '246, 243, 236',
  shadeRgb: '0, 0, 0',
  sheenRgb: '0, 0, 0',
  glowRgb: '160, 140, 100',

  logoFilter: LOGO_FILTERS.pitchBlack,
}

export const THEMES = { dark, light } satisfies Record<string, ThemePalette>

export type ThemeName = keyof typeof THEMES

/** Theme used on first visit. 'dark' reproduces the original site. */
export const DEFAULT_THEME: ThemeName = 'dark'

/** Flip to true to show the theme toggle button in the header. */
export const SHOW_THEME_TOGGLE = true

export const FONT_FAMILY = 'Arial, Helvetica, sans-serif'

/** Prefix for generated CSS variables: `--c-<token>`. */
export const CSS_VAR_PREFIX = '--c-'
