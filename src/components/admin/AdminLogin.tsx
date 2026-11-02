import { useState, type FormEvent } from 'react'
import { ADMIN_PASSCODE_MIN_LENGTH } from '../../constants/site'
import { STORAGE_KEYS } from '../../constants/storage'
import { readString, writeString } from '../../utils/storage'

interface AdminLoginProps {
  onSuccess: () => void
  onCancel: () => void
}

export function AdminLogin({ onSuccess, onCancel }: AdminLoginProps) {
  const [existing] = useState(() => readString(STORAGE_KEYS.adminPasscode))
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState('')
  const hasPass = !!existing

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!hasPass) {
      if (pass.length < ADMIN_PASSCODE_MIN_LENGTH) return setStatus(`Use at least ${ADMIN_PASSCODE_MIN_LENGTH} characters.`)
      if (pass !== confirm) return setStatus('Passcodes do not match.')
      writeString(STORAGE_KEYS.adminPasscode, pass)
    } else if (pass !== existing) {
      return setStatus('Incorrect passcode.')
    }
    writeString(STORAGE_KEYS.adminSession, '1', sessionStorage)
    onSuccess()
  }

  return (
    <div className="inventory-login open" role="dialog" aria-modal="true" aria-label="DUSKEO admin login">
      <div className="inventory-login-panel">
        <p className="inventory-login-kicker">DUSKEO / PRIVATE ACCESS</p>
        <h2>{hasPass ? 'ADMIN SIGN IN' : 'CREATE ADMIN PASSCODE'}</h2>
        <p>
          {hasPass
            ? 'Enter your admin passcode to manage product stock.'
            : 'Create a passcode for this browser to open inventory controls.'}
        </p>
        <form onSubmit={submit}>
          <input
            type="password"
            autoComplete={hasPass ? 'current-password' : 'new-password'}
            placeholder="Admin passcode"
            required
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
          {!hasPass && (
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm passcode"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}
          <button type="submit">{hasPass ? 'SIGN IN' : 'CREATE PASSCODE'}</button>
        </form>
        <p className="inventory-login-status" aria-live="polite">
          {status}
        </p>
        <button type="button" onClick={onCancel}>
          CANCEL
        </button>
        <p className="inventory-login-note">
          Prototype access only. A static HTML site cannot provide secure authentication. Use server-side
          authentication before publishing.
        </p>
      </div>
    </div>
  )
}
