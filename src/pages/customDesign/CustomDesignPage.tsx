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
  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')

    const designFiles = [frontFile, backFile].filter((file): file is File => file !== null)
    const invalidFile = designFiles.find((file) => !ALLOWED_TYPES.includes(file.type))
    if (invalidFile) {
      setMessage(`${invalidFile.name}: upload a JPG, PNG, or WebP image.`)
      return
    }
    const oversizedFile = designFiles.find((file) => file.size > MAX_FILE_SIZE)
    if (oversizedFile) {
      setMessage(`${oversizedFile.name}: images must be 5 MB or smaller.`)
      return
    }

    setBusy(true)
    let frontImagePath: string | null = null
    let backImagePath: string | null = null
    try {
      if (frontFile) {
        const frontExtension = frontFile.type === 'image/jpeg' ? 'jpg' : frontFile.type.split('/')[1]
        frontImagePath = `${crypto.randomUUID()}-front.${frontExtension}`
        const { error: frontUploadError } = await supabase.storage
          .from('custom-design-requests')
          .upload(frontImagePath, frontFile, { contentType: frontFile.type, upsert: false })
        if (frontUploadError) throw new Error(`Could not upload the front image: ${frontUploadError.message}`)
      }

      if (backFile) {
        const backExtension = backFile.type === 'image/jpeg' ? 'jpg' : backFile.type.split('/')[1]
        backImagePath = `${crypto.randomUUID()}-back.${backExtension}`
        const { error: backUploadError } = await supabase.storage
          .from('custom-design-requests')
          .upload(backImagePath, backFile, { contentType: backFile.type, upsert: false })
        if (backUploadError) throw new Error(`Could not upload the back image: ${backUploadError.message}`)
      }

      const { error } = await supabase.from('custom_design_requests').insert({
        customer_name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        garment,
        size: size || null,
        details: details.trim(),
        front_image_path: frontImagePath,
        back_image_path: backImagePath,
      })
      if (error) throw new Error(`Could not send your request: ${error.message}`)
      setSubmitted(true)
      setName('')
      setEmail('')
      setPhone('')
      setGarment('T-shirt')
      setSize('')
      setDetails('')
      setFrontFile(null)
      setBackFile(null)
    } catch (error) {
      const uploadedPaths = [frontImagePath, backImagePath].filter((path): path is string => path !== null)
      if (uploadedPaths.length) {
        const { error: cleanupError } = await supabase.storage.from('custom-design-requests').remove(uploadedPaths)
        if (cleanupError) console.error('Could not clean up custom design images after submission failed.', cleanupError)
      }
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
        <p>Share your idea and, if you have them, upload images of the front and back. We’ll review your request and contact you about availability, pricing, and next steps. Submitting a request does not place an order or charge you.</p>
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
            FRONT DESIGN IMAGE (OPTIONAL)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setFrontFile(event.target.files?.[0] ?? null)}
            />
            <span>{frontFile ? `${frontFile.name} · ${(frontFile.size / 1024 / 1024).toFixed(1)} MB` : 'JPG, PNG, or WebP · up to 5 MB'}</span>
          </label>
          <label className="custom-design-file">
            BACK DESIGN IMAGE (OPTIONAL)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setBackFile(event.target.files?.[0] ?? null)}
            />
            <span>{backFile ? `${backFile.name} · ${(backFile.size / 1024 / 1024).toFixed(1)} MB` : 'JPG, PNG, or WebP · up to 5 MB'}</span>
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
