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
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileStatus, setProfileStatus] = useState('')
  const [profileDraft, setProfileDraft] = useState({
    fullName: account.name,
    phone: account.phone,
    gender: account.gender,
    dateOfBirth: account.dateOfBirth,
  })

  const openProfileEditor = () => {
    setProfileDraft({
      fullName: account.name,
      phone: account.phone,
      gender: account.gender,
      dateOfBirth: account.dateOfBirth,
    })
    setProfileStatus('')
    setEditingProfile(true)
  }

  const saveProfile = async () => {
    setProfileBusy(true)
    setProfileStatus('')
    const result = await account.updateProfile(profileDraft)
    if (result.ok) {
      setEditingProfile(false)
      setProfileStatus('Profile updated.')
    } else {
      setProfileStatus(result.error || 'Could not update profile.')
    }
    setProfileBusy(false)
  }

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
          {editingProfile ? (
            <div className="acct-profile-form acct-form">
              <strong className="acct-form-title">EDIT PROFILE</strong>
              <label>
                <span className="acct-label">Name</span>
                <input
                  value={profileDraft.fullName}
                  onChange={(event) => setProfileDraft((draft) => ({ ...draft, fullName: event.target.value }))}
                  autoComplete="name"
                  placeholder="Full name"
                />
              </label>
              <label>
                <span className="acct-label">Mobile</span>
                <input
                  value={profileDraft.phone}
                  onChange={(event) => setProfileDraft((draft) => ({
                    ...draft,
                    phone: event.target.value.replace(/\D/g, '').slice(0, 10),
                  }))}
                  autoComplete="tel-national"
                  inputMode="numeric"
                  placeholder="10-digit mobile number"
                />
              </label>
              <label>
                <span className="acct-label">Gender</span>
                <select
                  value={profileDraft.gender}
                  onChange={(event) => setProfileDraft((draft) => ({
                    ...draft,
                    gender: event.target.value as typeof draft.gender,
                  }))}
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                <span className="acct-label">Date of birth</span>
                <input
                  type="date"
                  value={profileDraft.dateOfBirth}
                  onChange={(event) => setProfileDraft((draft) => ({ ...draft, dateOfBirth: event.target.value }))}
                />
              </label>
              {profileStatus && <p className="acct-status">{profileStatus}</p>}
              <div className="acct-profile-actions">
                <button type="button" className="outline" disabled={profileBusy} onClick={() => void saveProfile()}>
                  {profileBusy ? 'SAVING…' : 'SAVE'}
                </button>
                <button type="button" className="acct-text-btn" disabled={profileBusy} onClick={() => setEditingProfile(false)}>
                  CANCEL
                </button>
              </div>
            </div>
          ) : (
            <>
              <span className="acct-label">Name</span>
              <strong>{account.name || '—'}</strong>
              <span className="acct-label">Email</span>
              <strong className="acct-wrap">{account.email || '—'}</strong>
              <span className="acct-label">Mobile</span>
              <strong>{account.phone || '—'}</strong>
              <span className="acct-label">Gender</span>
              <strong>{account.gender ? account.gender[0].toUpperCase() + account.gender.slice(1) : '—'}</strong>
              <span className="acct-label">Date of birth</span>
              <strong>{account.dateOfBirth || '—'}</strong>
              {profileStatus && <p className="acct-status">{profileStatus}</p>}
              <button type="button" className="outline acct-profile-edit" onClick={openProfileEditor}>
                EDIT PROFILE
              </button>
            </>
          )}
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
