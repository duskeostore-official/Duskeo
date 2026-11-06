import { useEffect, type ReactNode } from 'react'
import './Drawer.css'

interface DrawerProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** small = account / sign-in form; large = bag. */
  size?: 'small' | 'large'
}

/** Centered pop-up panel with a dimmed backdrop (bag, account). Fits the screen on phones. */
export function Drawer({ open, title, onClose, children, size = 'small' }: DrawerProps) {
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

  return (
    <div
      className={`shade${open ? ' open' : ''}`}
      aria-hidden={!open}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`drawer is-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <strong>{title}</strong>
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  )
}
