import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { BottomSheet } from '../../components/common/BottomSheet'
import { ProductRail } from '../../components/productCard/ProductRail'
import { RAIL_SPEEDS, titleFor } from '../../constants/site'
import { useInventory } from '../../context/inventory/useInventory'
import { useProductModal } from '../../context/productModal/useProductModal'
import { PRODUCTS } from '../../data/products'
import {
  EMPTY_FILTERS,
  MIN_RAIL_ITEMS,
  POPULAR_SEARCHES,
  SEARCH_RAILS,
  SORT_OPTIONS,
  type ThemedRail,
} from '../../data/searchConfig'
import { searchHref } from '../../hooks/useHashRoute'
import type { SearchFilters, SearchMode, SortKey } from '../../types'
import { activeFilterCount, applyFilters, searchProducts, seededShuffle, sortResults, toggleIn } from '../../utils/search'
import { ActiveFilters } from './components/ActiveFilters'
import { FilterPanel } from './components/FilterPanel'
import { ResultsGrid } from './components/ResultsGrid'
import { SearchBar } from './components/SearchBar'
import { SearchHero } from './components/SearchHero'
import { SortOptions } from './components/SortOptions'
import { ThemeMoods } from './components/ThemeMoods'
import './SearchPage.css'

/** New random order of themed rails (and their items) on every page load. */
const SESSION_SEED = Math.floor(Math.random() * 100_000) + 1

const THEMED_RAILS: ThemedRail[] = seededShuffle(SEARCH_RAILS, SESSION_SEED)
  .map((rail, i) => ({ ...rail, products: seededShuffle(PRODUCTS.filter(rail.match), SESSION_SEED + i + 1) }))
  .filter((rail) => rail.products.length >= MIN_RAIL_ITEMS)

type Sheet = 'sort' | 'filter' | null

interface SearchPageProps {
  initialQuery: string
  /** 'explore' adds the themed hero, mood tiles, featured cards and rails. */
  mode: SearchMode
}

export function SearchPage({ initialQuery, mode }: SearchPageProps) {
  const isExplore = mode === 'explore'
  const [query, setQuery] = useState(initialQuery)
  const [sort, setSort] = useState<SortKey>('relevance')
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS)
  const [sheet, setSheet] = useState<Sheet>(null)
  const inventory = useInventory()
  const modal = useProductModal()
  // Typing stays responsive; results catch up a moment later.
  const term = useDeferredValue(query.trim())

  // Keep the URL shareable without adding a history entry per keystroke.
  useEffect(() => {
    history.replaceState(history.state, '', searchHref(term, mode))
    document.title = titleFor(isExplore ? 'Explore the Collection' : term ? `Search: ${term}` : 'Search')
  }, [term, mode, isExplore])

  const pool = useMemo(() => searchProducts(PRODUCTS, term), [term])
  const poolProducts = useMemo(() => pool.map((r) => r.product), [pool])
  const results = useMemo(
    () => sortResults(applyFilters(pool, filters, inventory.quantity), sort),
    [pool, filters, inventory.quantity, sort],
  )

  // Rails matching the top result's theme come first, so they relate to the search.
  const rails = useMemo(() => {
    const top = results[0]
    if (!top) return THEMED_RAILS
    return [...THEMED_RAILS].sort((a, b) => Number(b.match(top)) - Number(a.match(top)))
  }, [results])

  const filterCount = activeFilterCount(filters)
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label
  const closeSheet = () => setSheet(null)

  return (
    <main className={`search-page is-${mode}`}>
      {isExplore && <SearchHero term={term} count={results.length} />}

      <div className="search-top">
        {/* Plain search focuses the box right away; explore leads with the hero. */}
        <SearchBar value={query} onChange={setQuery} autoFocus={!isExplore && !initialQuery} />
        <div className="search-tools" role="group" aria-label="Sort and filter">
          <button onClick={() => setSheet('sort')}>
            <span aria-hidden="true">⇅</span> SORT
            <small>{sortLabel}</small>
          </button>
          <button onClick={() => setSheet('filter')}>
            <span aria-hidden="true">☰</span> FILTER
            {filterCount > 0 && <b className="search-tools-badge">{filterCount}</b>}
          </button>
        </div>
      </div>

      {!term && (
        <div className="search-popular">
          <span>POPULAR</span>
          {POPULAR_SEARCHES.map((s) => (
            <button key={s} onClick={() => setQuery(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {isExplore && (
        <ThemeMoods
          selected={filters.themes}
          onToggle={(theme) => setFilters({ ...filters, themes: toggleIn(filters.themes, theme) })}
          pool={poolProducts}
        />
      )}

      <div className="search-layout">
        <aside className="search-sidebar" aria-label="Filters">
          <FilterPanel filters={filters} onChange={setFilters} pool={poolProducts} />
        </aside>

        <section className="search-main" aria-live="polite">
          <div className="search-summary">
            <span>
              SHOWING <b>{results.length}</b> {results.length === 1 ? 'ITEM' : 'ITEMS'}
              {!isExplore && term && <> FOR “{term}”</>}
            </span>
            <SortOptions variant="tabs" value={sort} onChange={setSort} />
          </div>
          <ActiveFilters filters={filters} onChange={setFilters} />

          {results.length > 0 ? (
            <ResultsGrid products={results} rails={rails} onOpen={modal.open} editorial={isExplore} />
          ) : (
            <div className="search-empty">
              <h2>NO MATCHES{term ? <> FOR “{term}”</> : null}</h2>
              <p>Try a different word, or remove some filters.</p>
              {filterCount > 0 && (
                <button className="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
                  CLEAR FILTERS
                </button>
              )}
              {isExplore && rails[0] && (
                <section className="results-rail" aria-label={rails[0].title}>
                  <div className="results-rail-head">
                    <span className="eyebrow">YOU MIGHT LIKE</span>
                    <h2>{rails[0].title}</h2>
                  </div>
                  <ProductRail
                    products={rails[0].products}
                    speed={RAIL_SPEEDS[0]}
                    direction={1}
                    label={rails[0].title}
                    onOpen={modal.open}
                  />
                </section>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Phone panels */}
      <BottomSheet open={sheet === 'sort'} title="SORT BY" onClose={closeSheet}>
        <SortOptions
          variant="list"
          value={sort}
          onChange={(key) => {
            setSort(key)
            closeSheet()
          }}
        />
      </BottomSheet>
      <BottomSheet
        open={sheet === 'filter'}
        title="FILTER"
        onClose={closeSheet}
        footer={
          <button className="search-apply" onClick={closeSheet}>
            SHOW {results.length} {results.length === 1 ? 'RESULT' : 'RESULTS'}
          </button>
        }
      >
        <FilterPanel filters={filters} onChange={setFilters} pool={poolProducts} />
      </BottomSheet>
    </main>
  )
}
