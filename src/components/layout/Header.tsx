import { useCallback, useState } from 'react'
import logo from '../../assets/images/brand/new-logo.webp'
import { ROUTES } from '../../constants/routes'
import { SHOW_THEME_TOGGLE } from '../../constants/theme'
import { useCart } from '../../context/cart/useCart'
import { CartIcon, ProfileIcon, SearchIcon } from '../common/Icons'
import { ThemeToggle } from '../theme/ThemeToggle'
import { MobileMenu } from './MobileMenu'
import './Header.css'

interface HeaderProps {
  onOpenProfile: () => void
}

export function Header({ onOpenProfile }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const cart = useCart()

  return (
    <header className="header">
      <div className="leftnav">
        <button className="menu-toggle" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
          ☰
        </button>
        <nav className="nav">
          <a href={ROUTES.collection}>SHOP</a>
        </nav>
      </div>
      <MobileMenu open={menuOpen} onClose={closeMenu} onOpenProfile={onOpenProfile} />

      <a aria-label="DUSKEO home" href={ROUTES.top}>
        <img className="logo" src={logo} alt="DUSKEO official logo" fetchPriority="high" decoding="async" />
      </a>

      <nav className="nav right">
        <a className="story-link" href={ROUTES.ourStory}>
          OUR STORY
        </a>
        <a className="contact-link" href={ROUTES.footer}>
          CONTACT
        </a>
        {SHOW_THEME_TOGGLE && <ThemeToggle />}
        <a
          className="header-icon search-icon"
          href={ROUTES.search}
          aria-label="Search products"
          title="Search products"
        >
          <SearchIcon />
        </a>
        <button className="header-icon profile-btn" aria-label="Profile" title="Profile" onClick={onOpenProfile}>
          <ProfileIcon />
        </button>
        <button className="header-icon cart-btn" aria-label="Shopping cart" title="Shopping cart" onClick={cart.open}>
          <CartIcon />
          <span className="bag-count">{cart.count}</span>
        </button>
      </nav>
    </header>
  )
}
