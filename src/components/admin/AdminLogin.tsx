import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

interface AdminLoginProps {
  onSuccess: () => void
  onCancel: () => void
}

export function AdminLogin({ onSuccess, onCancel }: AdminLoginProps) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setStatus('')
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    })
    if (error) {
      setStatus(error.message)
      setBusy(false)
      return
    }
    const { data, error: adminError } = await supabase.rpc('is_admin')
    if (adminError || data !== true) {
      await supabase.auth.signOut()
      setStatus('This account is not authorized as a DUSKEO administrator.')
      setBusy(false)
      return
    }
    setBusy(false)
    onSuccess()
  }

  return (
    <div className="inventory-login open" role="dialog" aria-modal="true" aria-label="DUSKEO admin login">
      <div className="inventory-login-panel">
        <p className="inventory-login-kicker">DUSKEO / PRIVATE ACCESS</p>
        <h2>ADMIN SIGN IN</h2>
        <p>Sign in with the administrator account configured in Supabase.</p>
        <form onSubmit={submit}>
          <input
            type="email"
            autoComplete="email"
            placeholder="Administrator email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            required
            value={pass}
            onChange={(event) => setPass(event.target.value)}
          />
          <button type="submit" disabled={busy}>{busy ? 'SIGNING IN…' : 'SIGN IN'}</button>
        </form>
        <p className="inventory-login-status" aria-live="polite">{status}</p>
        <button type="button" onClick={onCancel}>CANCEL</button>
      </div>
    </div>
  )
}
