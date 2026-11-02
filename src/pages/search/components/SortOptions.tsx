import { SORT_OPTIONS } from '../../../data/searchConfig'
import type { SortKey } from '../../../types'

interface SortOptionsProps {
  value: SortKey
  onChange: (key: SortKey) => void
  /** 'tabs' = inline row (laptop), 'list' = radio list (phone sheet). */
  variant: 'tabs' | 'list'
}

export function SortOptions({ value, onChange, variant }: SortOptionsProps) {
  if (variant === 'tabs') {
    return (
      <div className="sort-tabs" role="radiogroup" aria-label="Sort by">
        <span className="sort-tabs-label">SORT BY</span>
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.key}
            role="radio"
            aria-checked={value === o.key}
            className={value === o.key ? 'is-active' : undefined}
            onClick={() => onChange(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="sort-list" role="radiogroup" aria-label="Sort by">
      {SORT_OPTIONS.map((o) => (
        <label key={o.key} className="sort-list-item">
          <span>{o.label}</span>
          <input type="radio" name="sort" checked={value === o.key} onChange={() => onChange(o.key)} />
        </label>
      ))}
    </div>
  )
}
