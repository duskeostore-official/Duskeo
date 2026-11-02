import { PRICE_RANGES } from '../../../data/searchConfig'
import type { SearchFilters } from '../../../types'

interface ActiveFiltersProps {
  filters: SearchFilters
  onChange: (next: SearchFilters) => void
}

/** Removable chips for each applied filter. */
export function ActiveFilters({ filters, onChange }: ActiveFiltersProps) {
  const chips = [
    ...filters.themes.map((t) => ({
      key: `t-${t}`,
      label: t,
      remove: () => onChange({ ...filters, themes: filters.themes.filter((x) => x !== t) }),
    })),
    ...filters.prices.map((id) => ({
      key: `p-${id}`,
      label: PRICE_RANGES.find((r) => r.id === id)?.label ?? id,
      remove: () => onChange({ ...filters, prices: filters.prices.filter((x) => x !== id) }),
    })),
    ...filters.sizes.map((s) => ({
      key: `s-${s}`,
      label: `Size ${s}`,
      remove: () => onChange({ ...filters, sizes: filters.sizes.filter((x) => x !== s) }),
    })),
    ...(filters.inStockOnly
      ? [{ key: 'stock', label: 'In stock', remove: () => onChange({ ...filters, inStockOnly: false }) }]
      : []),
  ]

  if (!chips.length) return null

  return (
    <div className="active-filters">
      {chips.map((chip) => (
        <button key={chip.key} className="active-chip" onClick={chip.remove} aria-label={`Remove filter ${chip.label}`}>
          {chip.label} <span aria-hidden="true">×</span>
        </button>
      ))}
    </div>
  )
}
