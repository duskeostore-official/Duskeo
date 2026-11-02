import { LOGO_FILTER_IDS } from '../../constants/theme'

/**
 * Hidden SVG filter definitions, referenced from CSS via `filter: url(#id)`.
 *
 * pitch-black: turns the ivory-on-transparent logo into pure #000.
 *   1. Use each pixel's brightness as its new opacity, with color set to black,
 *      so bright ivory strokes become solid black and the dark shading/smoke
 *      (which only made sense on a dark background) fades away.
 *   2. Multiply by the original opacity so transparent areas stay transparent.
 *   3. Boost opacity so the ivory strokes reach full black.
 */
export function LogoFilters() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <filter id={LOGO_FILTER_IDS.pitchBlack} colorInterpolationFilters="sRGB">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  0.2126 0.7152 0.0722 0 0"
          result="brightnessAsAlpha"
        />
        <feComposite in="brightnessAsAlpha" in2="SourceAlpha" operator="in" result="masked" />
        <feComponentTransfer in="masked">
          <feFuncA type="linear" slope="1.35" intercept="-0.05" />
        </feComponentTransfer>
      </filter>
    </svg>
  )
}
