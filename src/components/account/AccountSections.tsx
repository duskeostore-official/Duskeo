import { useState } from 'react'
import { useAccount } from '../../context/account/useAccount'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../theme/useTheme'
import { AddressBook } from './AddressBook'
import { OrderList } from './OrderList'
import './AccountSections.css'

/** How many orders / addresses the panel shows before "view all". */
const PANEL_ORDERS = 5
const PANEL_ADDRESSES = 5 // the default + the 4 newest

interface AccountSectionsProps {
  /** Shown to signed-out visitors as a "sign in" card; omit to show nothing extra. */
  onSignIn?: () => void
  /** Called when a link leaves the panel (view all, an order), so the panel can close. */
  onNavigate?: () => void
}

/**
 * Appearance, profile, latest orders, saved addresses and sign out, stacked vertically.
 * Used by the phone menu (☰) and the profile pop-up on larger screens.
 */
export function AccountSections({ onSignIn, onNavigate }: AccountSectionsProps) {
  const { themeName, toggleTheme } = useTheme()
  const account = useAccount()
  const [busy, setBusy] = useState(false)

  const signOut = async () => {
    setBusy(true)
    await supabase.auth.signOut()
    setBusy(false)
  }

  return (
    <div className="acct">
    <section className="acct-section">
      <h3>APPEARANCE</h3>
      <button
        type="button"
        className="acct-row acct-switch"
        role="switch"
        aria-checked={themeName === 'light'}
        onClick={toggleTheme}
      >
        <span>Light mode</span>
        <span className={`acct-switch-track${themeName === 'light' ? ' on' : ''}`} aria-hidden="true">
          <span />
        </span>
      </button>
    </section>

    <section className="acct-section">
      <h3>PROFILE</h3>
      {account.userId ? (
        <div className="acct-card">
          <span className="acct-label">Name</span>
          <strong>{account.name || '—'}</strong>
          <span className="acct-label">Email</span>
          <strong className="acct-wrap">{account.email || '—'}</strong>
        </div>
      ) : onSignIn ? (
        <div className="acct-card">
          <p>Sign in to see your profile, orders and saved addresses.</p>
          <button type="button" className="outline" onClick={onSignIn}>
            SIGN IN / CREATE ACCOUNT
          </button>
        </div>
      ) : null}
    </section>

    {account.userId && (
      <>
        <section className="acct-section">
          <h3>MY ORDERS</h3>
          <OrderList limit={PANEL_ORDERS} onNavigate={onNavigate} />
        </section>

        <section className="acct-section">
          <h3>ADDRESSES</h3>
          <AddressBook limit={PANEL_ADDRESSES} onNavigate={onNavigate} />
        </section>

        <section className="acct-section">
          <button type="button" className="outline acct-signout" disabled={busy} onClick={() => void signOut()}>
            {busy ? 'PLEASE WAIT…' : 'SIGN OUT'}
          </button>
        </section>
      </>
    )}
    </div>
  )
}
