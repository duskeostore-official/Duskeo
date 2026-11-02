import type { ReactNode } from 'react'
import './Drawer.css'

interface DrawerProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/** Right-side slide-in panel with a dimmed backdrop (cart, account). */
export function Drawer({ open, title, onClose, children }: DrawerProps) {
  return (
    <div className={`shade${open ? ' open' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer">
        <div className="drawer-head">
          <strong>{title}</strong>
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
