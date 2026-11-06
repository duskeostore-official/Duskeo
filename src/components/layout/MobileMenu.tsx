import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AccountSections } from '../account/AccountSections'
import './MobileMenu.css'

interface MobileMenuProps {
  open: boolean
  onClose: () => void
  onOpenProfile: () => void
}

/** Phone menu (☰): slides in from the left with the account sections stacked vertically. */
export function MobileMenu({ open, onClose, onOpenProfile }: MobileMenuProps) {
  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    const previous = html.style.overflow
    html.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      html.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const signIn = () => {
    onClose()
    onOpenProfile()
  }

  return createPortal(
    <div className={`mmenu${open ? ' open' : ''}`} aria-hidden={!open} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="mmenu-panel" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="mmenu-head">
          <strong>MENU</strong>
          <button type="button" className="mmenu-close" aria-label="Close menu" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="mmenu-body">
          <AccountSections onSignIn={signIn} onNavigate={onClose} />
        </div>
      </aside>
    </div>,
    document.body,
  )
}
