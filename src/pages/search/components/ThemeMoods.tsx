import { useCatalog } from '../../../context/catalog/useCatalog'
import { PRODUCT_THEMES, THEME_MOODS } from '../../../data/searchConfig'
import type { Product, ProductTheme } from '../../../types'

interface ThemeMoodsProps {
  selected: ProductTheme[]
  onToggle: (theme: ProductTheme) => void
  /** Products matching the text query — for the counts. */
  pool: Product[]
}

/** "Shop by mood" — large image tiles that double as theme filters. */
export function ThemeMoods({ selected, onToggle, pool }: ThemeMoodsProps) {
  const catalog = useCatalog()
  return (
    <section className="moods" aria-label="Shop by mood">
      <div className="moods-head">
        <span className="eyebrow">SHOP BY MOOD</span>
      </div>
      <div className="moods-list">
        {PRODUCT_THEMES.map((theme) => {
          const cover = catalog.products.find((p) => p.theme === theme)?.photos[0].src
          const count = pool.filter((p) => p.theme === theme).length
          const isOn = selected.includes(theme)
          return (
            <button
              key={theme}
              className={`mood${isOn ? ' is-on' : ''}`}
              aria-pressed={isOn}
              onClick={() => onToggle(theme)}
            >
              {cover && <img src={cover} alt="" loading="lazy" draggable={false} />}
              <span className="mood-symbol" aria-hidden="true">
                {THEME_MOODS[theme].symbol}
              </span>
              <span className="mood-text">
                <strong>{theme.toUpperCase()}</strong>
                <small>{THEME_MOODS[theme].tagline}</small>
              </span>
              <span className="mood-count">
                {isOn ? '✓ SELECTED' : `${count} ${count === 1 ? 'PIECE' : 'PIECES'}`}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
