import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type RequestStatus = 'new' | 'reviewing' | 'contacted' | 'closed'

interface CustomDesignRequest {
  id: number
  customer_name: string
  email: string
  phone: string | null
  garment: string
  size: string | null
  details: string
  image_path: string | null
  status: RequestStatus
  created_at: string
}

const STATUSES: RequestStatus[] = ['new', 'reviewing', 'contacted', 'closed']

export function CustomDesignRequestsAdmin() {
  const [requests, setRequests] = useState<CustomDesignRequest[]>([])
  const [imageUrls, setImageUrls] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: loadError } = await supabase
      .from('custom_design_requests')
      .select('id, customer_name, email, phone, garment, size, details, image_path, status, created_at')
      .order('created_at', { ascending: false })
    if (loadError) {
      setError(`Could not load custom design requests: ${loadError.message}`)
      setLoading(false)
      return
    }

    const loadedRequests = (data ?? []) as CustomDesignRequest[]
    const signedImages = await Promise.all(loadedRequests.flatMap((request) => {
      if (!request.image_path) return []
      return [supabase.storage.from('custom-design-requests').createSignedUrl(request.image_path, 60 * 60)]
    }))
    const nextUrls: Record<number, string> = {}
    let imageIndex = 0
    for (const request of loadedRequests) {
      if (!request.image_path) continue
      const signedImage = signedImages[imageIndex++]
      if (signedImage.error) {
        setError(`Requests loaded, but an uploaded design image could not be opened: ${signedImage.error.message}`)
        continue
      }
      nextUrls[request.id] = signedImage.data.signedUrl
    }
    setRequests(loadedRequests)
    setImageUrls(nextUrls)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRequests(), 0)
    return () => window.clearTimeout(timer)
  }, [loadRequests])

  const updateStatus = async (id: number, status: RequestStatus) => {
    setError('')
    const { error: updateError } = await supabase
      .from('custom_design_requests')
      .update({ status })
      .eq('id', id)
    if (updateError) {
      setError(`Could not update request status: ${updateError.message}`)
      return
    }
    setRequests((current) => current.map((request) => request.id === id ? { ...request, status } : request))
  }

  return (
    <section className="custom-requests-admin" aria-labelledby="custom-requests-heading">
      <div className="orders-admin-head">
        <div>
          <h3 id="custom-requests-heading">CUSTOM DESIGN REQUESTS</h3>
          <p>{requests.length} request{requests.length === 1 ? '' : 's'}</p>
        </div>
        <button type="button" onClick={() => void loadRequests()} disabled={loading}>
          {loading ? 'LOADING…' : 'REFRESH'}
        </button>
      </div>
      {error && <p className="orders-admin-error" role="alert">{error}</p>}
      {loading ? (
        <p className="orders-admin-message" role="status">Loading requests…</p>
      ) : requests.length === 0 ? (
        <p className="orders-admin-message">No custom design requests yet.</p>
      ) : (
        <div className="custom-requests-list">
          {requests.map((request) => (
            <article className="custom-request-card" key={request.id}>
              <header>
                <div>
                  <strong>{request.customer_name}</strong>
                  <span>{new Date(request.created_at).toLocaleString('en-IN')}</span>
                </div>
                <select
                  aria-label={`Status for request ${request.id}`}
                  value={request.status}
                  onChange={(event) => {
                    const status = STATUSES.find((candidate) => candidate === event.target.value)
                    if (status) void updateStatus(request.id, status)
                  }}
                >
                  {STATUSES.map((status) => <option key={status} value={status}>{status.toUpperCase()}</option>)}
                </select>
              </header>
              <p>
                <a href={`mailto:${encodeURIComponent(request.email)}`}>{request.email}</a>
                {request.phone && <> · <a href={`tel:${encodeURIComponent(request.phone)}`}>{request.phone}</a></>}
              </p>
              <p>{request.garment}{request.size ? ` · Size ${request.size}` : ''}</p>
              <p className="custom-request-details">{request.details}</p>
              {request.image_path && imageUrls[request.id] && (
                <a href={imageUrls[request.id]} target="_blank" rel="noreferrer">VIEW DESIGN IMAGE</a>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
