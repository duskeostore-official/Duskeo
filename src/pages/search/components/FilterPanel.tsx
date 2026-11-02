import { SIZES } from '../../../constants/site'
import { EMPTY_FILTERS, PRICE_RANGES, PRODUCT_THEMES } from '../../../data/searchConfig'
import type { Product, SearchFilters } from '../../../types'
import { activeFilterCount, toggleIn } from '../../../utils/search'

interface FilterPanelProps {
  filters: SearchFilters
  onChange: (next: SearchFilters) => void
  /** Products matching the text query — used for the counts next to options. */
  pool: Product[]
}

/** Filter options. Shown as a sidebar on laptops and inside a bottom sheet on phones. */
export function FilterPanel({ filters, onChange, pool }: FilterPanelProps) {
  const count = activeFilterCount(filters)
  const set = (patch: Partial<SearchFilters>) => onChange({ ...filters, ...patch })

  return (
    <div className="filters">
      <div className="filters-head">
        <span>FILTERS{count ? ` (${count})` : ''}</span>
        {count > 0 && (
          <button className="filters-clear" onClick={() => onChange(EMPTY_FILTERS)}>
            CLEAR ALL
          </button>
        )}
      </div>

      <details className="filters-group" open>
        <summary>THEME</summary>
        {PRODUCT_THEMES.map((theme) => (
          <label className="filters-check" key={theme}>
            <input
              type="checkbox"
              checked={filters.themes.includes(theme)}
              onChange={() => set({ themes: toggleIn(filters.themes, theme) })}
            />
            <span>{theme}</span>
            <em>{pool.filter((p) => p.theme === theme).length}</em>
          </label>
        ))}
      </details>

      <details className="filters-group" open>
        <summary>PRICE</summary>
        {PRICE_RANGES.map((range) => (
          <label className="filters-check" key={range.id}>
            <input
              type="checkbox"
              checked={filters.prices.includes(range.id)}
              onChange={() => set({ prices: toggleIn(filters.prices, range.id) })}
            />
            <span>{range.label}</span>
            <em>{pool.filter((p) => range.test(p.price)).length}</em>
          </label>
        ))}
      </details>

      <details className="filters-group" open>
        <summary>SIZE IN STOCK</summary>
        <div className="filters-sizes">
          {SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={filters.sizes.includes(size) ? 'is-on' : undefined}
              aria-pressed={filters.sizes.includes(size)}
              onClick={() => set({ sizes: toggleIn(filters.sizes, size) })}
            >
              {size}
            </button>
          ))}
        </div>
      </details>

      <label className="filters-switch">
        <input type="checkbox" checked={filters.inStockOnly} onChange={(e) => set({ inStockOnly: e.target.checked })} />
        <span className="filters-switch-track" aria-hidden="true" />
        <span>In stock only</span>
      </label>
    </div>
  )
}
