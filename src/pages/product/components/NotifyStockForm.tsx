import { useState, type FormEvent } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Size } from '../../../types'

interface NotifyStockFormProps {
  product: string
  size: Size
  visible: boolean
}

export function NotifyStockForm({ product, size, visible }: NotifyStockFormProps) {
  const [email, setEmail] = useState('')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setBusy(true)
    const { error } = await supabase.from('restock_requests').insert({
      product,
      size,
      email: trimmed,
    })
    setResult(error ? 'Could not save your request. Please try again.' : 'Restock request saved.')
    if (!error) setEmail('')
    setBusy(false)
  }

  return (
    <form className={`notify-stock${visible ? ' show' : ''}`} onSubmit={submit}>
      <p>This size is currently sold out. Leave your email and we’ll save a restock request.</p>
      <input
        type="email"
        name="email"
        placeholder="Your email address"
        required
        aria-label="Email address for restock request"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <button type="submit" disabled={busy}>{busy ? 'SAVING…' : 'NOTIFY ME WHEN AVAILABLE'}</button>
      <p className="notify-result" aria-live="polite">{result}</p>
    </form>
  )
}
