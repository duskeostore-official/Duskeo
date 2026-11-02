import { useState, type FormEvent } from 'react'
import { STORAGE_KEYS } from '../../../constants/storage'
import type { RestockRequest, Size } from '../../../types'
import { readJson, writeJson } from '../../../utils/storage'

interface NotifyStockFormProps {
  product: string
  size: Size
  visible: boolean
}

/** Shown when the selected size is sold out; saves a restock request locally. */
export function NotifyStockForm({ product, size, visible }: NotifyStockFormProps) {
  const [email, setEmail] = useState('')
  const [result, setResult] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    const requests = readJson<RestockRequest[]>(STORAGE_KEYS.restockRequests, [])
    requests.push({ product, size, email: trimmed, requestedAt: new Date().toISOString() })
    writeJson(STORAGE_KEYS.restockRequests, requests)
    setResult('Request saved on this device. Email alerts need a connected backend.')
    setEmail('')
  }

  return (
    <form className={`notify-stock${visible ? ' show' : ''}`} onSubmit={submit}>
      <p>This size is currently sold out. Leave your email and we’ll save a restock request on this device.</p>
      <input
        type="email"
        name="email"
        placeholder="Your email address"
        required
        aria-label="Email address for restock request"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit">NOTIFY ME WHEN AVAILABLE</button>
      <p className="notify-result" aria-live="polite">
        {result}
      </p>
    </form>
  )
}
