import { useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { Drawer } from '../common/Drawer'
import './ProfileDrawer.css'

interface ProfileDrawerProps {
  open: boolean
  onClose: () => void
}

export function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  const [user, setUser] = useState<User | null>(null)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setStatus('')

    if (mode === 'signup') {
      if (fullName.trim().length < 2) {
        setStatus('Enter your full name.')
        setBusy(false)
        return
      }
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      })
      if (error) {
        setStatus(error.message)
      } else {
        setStatus('Account created. Check your email if confirmation is required.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      setStatus(error ? error.message : '')
    }
    setBusy(false)
  }

  const signOut = async () => {
    setBusy(true)
    await supabase.auth.signOut()
    setStatus('')
    setPassword('')
    setBusy(false)
  }

  return (
    <Drawer open={open} title="YOUR ACCOUNT" onClose={onClose}>
      {user ? (
        <div className="profile-account">
          <p className="small-note">SIGNED IN</p>
          <strong>{user.user_metadata?.full_name || user.email || 'DUSKEO customer'}</strong>
          {user.email && <span className="small-note">{user.email}</span>}
          <button className="outline" type="button" onClick={() => void signOut()} disabled={busy}>
            {busy ? 'SIGNING OUT…' : 'SIGN OUT'}
          </button>
        </div>
      ) : (
        <>
          <p className="small-note">Sign in to your DUSKEO account.</p>
          <div className="profile-auth-tabs" role="tablist" aria-label="Account options">
            <button
              className={mode === 'signin' ? 'active' : ''}
              type="button"
              onClick={() => { setMode('signin'); setStatus('') }}
            >
              SIGN IN
            </button>
            <button
              className={mode === 'signup' ? 'active' : ''}
              type="button"
              onClick={() => { setMode('signup'); setStatus('') }}
            >
              CREATE ACCOUNT
            </button>
          </div>
          <form className="profile-auth-form" onSubmit={submit}>
            {mode === 'signup' && (
              <input
                type="text"
                autoComplete="name"
                placeholder="Full name"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            )}
            <input
              type="email"
              autoComplete="email"
              placeholder="Email address"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder="Password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button className="outline" type="submit" disabled={busy}>
              {busy ? 'PLEASE WAIT…' : mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </button>
          </form>
          {status && <p className="small-note" aria-live="polite">{status}</p>}
        </>
      )}
    </Drawer>
  )
}
