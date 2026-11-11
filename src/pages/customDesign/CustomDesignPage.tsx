import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import './CustomDesignPage.css'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function CustomDesignPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [garment, setGarment] = useState('T-shirt')
  const [size, setSize] = useState('')
  const [details, setDetails] = useState('')
  const [designFile, setDesignFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')

    if (designFile && !ALLOWED_TYPES.includes(designFile.type)) {
      setMessage('Upload a JPG, PNG, or WebP image.')
      return
    }
    if (designFile && designFile.size > MAX_FILE_SIZE) {
      setMessage('Your image must be 5 MB or smaller.')
      return
    }

    setBusy(true)
    let imagePath: string | null = null
    try {
      if (designFile) {
        const extension = designFile.type === 'image/jpeg' ? 'jpg' : designFile.type.split('/')[1]
        imagePath = `${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage
          .from('custom-design-requests')
          .upload(imagePath, designFile, { contentType: designFile.type, upsert: false })
        if (uploadError) throw new Error(`Could not upload your image: ${uploadError.message}`)
      }

      const { error } = await supabase.from('custom_design_requests').insert({
        customer_name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        garment,
        size: size || null,
        details: details.trim(),
        image_path: imagePath,
      })
      if (error) throw new Error(`Could not send your request: ${error.message}`)
      setSubmitted(true)
      setName('')
      setEmail('')
      setPhone('')
      setGarment('T-shirt')
      setSize('')
      setDetails('')
      setDesignFile(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send your request. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="custom-design-page">
      <header className="custom-design-header">
        <span>MADE YOUR WAY</span>
        <h1>ORDER YOUR CUSTOM DESIGN</h1>
        <p>Share your idea and we’ll review it. Our team will contact you about availability, pricing, and next steps. Submitting a request does not place an order or charge you.</p>
      </header>

      {submitted ? (
        <section className="custom-design-success" role="status">
          <h2>REQUEST RECEIVED</h2>
          <p>Thanks for sharing your idea. The DUSKEO team will review it and get back to you.</p>
          <button type="button" className="outline" onClick={() => setSubmitted(false)}>SEND ANOTHER REQUEST</button>
        </section>
      ) : (
        <form className="custom-design-form" onSubmit={(event) => void submit(event)}>
          <div className="custom-design-fields">
            <label>
              YOUR NAME
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} autoComplete="name" required />
            </label>
            <label>
              EMAIL ADDRESS
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" required />
            </label>
            <label>
              PHONE (OPTIONAL)
              <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} autoComplete="tel" />
            </label>
            <label>
              GARMENT
              <select value={garment} onChange={(event) => setGarment(event.target.value)}>
                <option>T-shirt</option>
                <option>Hoodie</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              SIZE (IF KNOWN)
              <select value={size} onChange={(event) => setSize(event.target.value)}>
                <option value="">Not sure yet</option>
                <option>S</option>
                <option>M</option>
                <option>L</option>
                <option>XL</option>
                <option>XXL</option>
              </select>
            </label>
            <label className="custom-design-details">
              DESCRIBE YOUR DESIGN
              <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={2000} rows={6} placeholder="Tell us about the artwork, colors, placement, or anything else we should know." required />
            </label>
          </div>
          <label className="custom-design-file">
            DESIGN IMAGE (OPTIONAL)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setDesignFile(event.target.files?.[0] ?? null)}
            />
            <span>{designFile ? `${designFile.name} · ${(designFile.size / 1024 / 1024).toFixed(1)} MB` : 'JPG, PNG, or WebP · up to 5 MB'}</span>
          </label>
          {message && <p className="custom-design-message" role="alert">{message}</p>}
          <button className="outline custom-design-submit" type="submit" disabled={busy}>
            {busy ? 'SENDING REQUEST…' : 'SEND CUSTOM DESIGN REQUEST →'}
          </button>
        </form>
      )}
    </main>
  )
}
