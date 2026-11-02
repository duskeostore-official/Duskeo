import { useEffect, useRef, useState } from 'react'
import { SearchIcon } from '../../../components/common/Icons'
import { POPULAR_SEARCHES } from '../../../data/searchConfig'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

const PLACEHOLDER_ROTATE_MS = 2600

export function SearchBar({ value, onChange, autoFocus }: SearchBarProps) {
  const input = useRef<HTMLInputElement>(null)
  const [hint, setHint] = useState(0)

  // Rotating suggestion in the placeholder while the field is empty.
  useEffect(() => {
    if (value) return
    const id = window.setInterval(() => setHint((h) => (h + 1) % POPULAR_SEARCHES.length), PLACEHOLDER_ROTATE_MS)
    return () => window.clearInterval(id)
  }, [value])

  // Press "/" anywhere to jump to the search field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.key !== '/' || target.closest('input, textarea, [contenteditable]')) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <form className="search-bar" role="search" onSubmit={(e) => (e.preventDefault(), input.current?.blur())}>
      <span className="search-bar-icon" aria-hidden="true">
        <SearchIcon />
      </span>
      <input
        ref={input}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Try “${POPULAR_SEARCHES[hint]}”`}
        aria-label="Search products"
        autoComplete="off"
        enterKeyHint="search"
        autoFocus={autoFocus}
      />
      {value ? (
        <button
          type="button"
          className="search-bar-clear"
          aria-label="Clear search"
          onClick={() => {
            onChange('')
            input.current?.focus()
          }}
        >
          ×
        </button>
      ) : (
        <kbd className="search-bar-kbd" aria-hidden="true">
          /
        </kbd>
      )}
    </form>
  )
}
