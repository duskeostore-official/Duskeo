interface SearchHeroProps {
  term: string
  count: number
}

/** Editorial header: a giant outlined word echoes the search, with a slow light sweep. */
export function SearchHero({ term, count }: SearchHeroProps) {
  const ghost = (term || 'ARCHIVE').toUpperCase()

  return (
    <header className="search-hero">
      <span className="search-hero-ghost" aria-hidden="true" data-text={ghost}>
        {ghost}
      </span>
      <p className="search-hero-kicker">DUSKEO / SEARCH</p>
      <h1 className="search-hero-title">{term ? <>“{term}”</> : 'THE FULL ARCHIVE'}</h1>
      <p className="search-hero-meta">
        <span>{count}</span> {count === 1 ? 'PIECE' : 'PIECES'} {term ? 'FOUND' : 'IN THE COLLECTION'}
      </p>
    </header>
  )
}
