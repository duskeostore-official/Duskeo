import { SIZES } from '../../../constants/site'
import type { Size } from '../../../types'

interface SizeSelectorProps {
  /** null = nothing picked yet */
  selected: Size | null
  isAvailable: (size: Size) => boolean
  onSelect: (size: Size) => void
}

export function SizeSelector({ selected, isAvailable, onSelect }: SizeSelectorProps) {
  return (
    <>
      <div className="product-size-heading">SELECT SIZE</div>
      <div className="product-size-options" role="group" aria-label="Select size">
        {SIZES.map((size) => {
          const available = isAvailable(size)
          const classes = ['product-size', size === selected && 'is-selected', !available && 'is-sold-out']
          return (
            <button
              key={size}
              type="button"
              className={classes.filter(Boolean).join(' ')}
              aria-label={`${size} — ${available ? 'in stock' : 'sold out'}`}
              onClick={() => onSelect(size)}
            >
              {size}
            </button>
          )
        })}
      </div>
    </>
  )
}
