export const SIZE_GUIDE_COLUMNS = ['SIZE', 'CHEST', 'SHOULDER', 'LENGTH', 'SLEEVE'] as const

/** Garment measurements in centimeters. */
export const SIZE_GUIDE_ROWS: string[][] = [
  ['S', '106.7', '50.8', '69.9', '21.6'],
  ['M', '111.8', '53.3', '71.1', '22.9'],
  ['L', '116.8', '55.9', '72.4', '24.1'],
  ['XL', '121.9', '58.4', '73.7', '25.4'],
  ['XXL', '127.0', '61.0', '74.9', '26.7'],
]

export const SIZE_GUIDE_TOLERANCE = 'All measurements are in centimeters. Allow ±2.54 cm variation.'

export const CARE_INSTRUCTIONS =
  "Wash inside out with similar colors. Use cold water and a gentle cycle. Do not bleach. Avoid ironing directly over printed artwork. Dry in shade and follow the garment's final care label."

export const CARE_CONFIRM_NOTE =
  'Fabric weight, fit and garment measurements must be confirmed against the final production sample before launch.'

export const PRODUCT_FOOTNOTE =
  'Please review the size guide before ordering. Color may vary slightly between screens.'
