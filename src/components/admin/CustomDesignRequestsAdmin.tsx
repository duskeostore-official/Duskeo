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
  front_image_path: string | null
  back_image_path: string | null
  status: RequestStatus
  created_at: string
}

const STATUSES: RequestStatus[] = ['new', 'reviewing', 'contacted', 'closed']

export function CustomDesignRequestsAdmin() {
  const [requests, setRequests] = useState<CustomDesignRequest[]>([])
  const [imageUrls, setImageUrls] = useState<Record<number, { front?: string; back?: string }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: loadError } = await supabase
      .from('custom_design_requests')
      .select('id, customer_name, email, phone, garment, size, details, front_image_path, back_image_path, status, created_at')
      .order('created_at', { ascending: false })
    if (loadError) {
      setError(`Could not load custom design requests: ${loadError.message}`)
      setLoading(false)
      return
    }

    const loadedRequests = (data ?? []) as CustomDesignRequest[]
    const signedImages = await Promise.all(loadedRequests.flatMap((request) => [
      request.front_image_path
        ? supabase.storage.from('custom-design-requests').createSignedUrl(request.front_image_path, 60 * 60)
        : Promise.resolve(null),
      request.back_image_path
        ? supabase.storage.from('custom-design-requests').createSignedUrl(request.back_image_path, 60 * 60)
        : Promise.resolve(null),
    ]))
    const nextUrls: Record<number, { front?: string; back?: string }> = {}
    for (let index = 0; index < loadedRequests.length; index++) {
      const request = loadedRequests[index]
      const frontImage = signedImages[index * 2]
      const backImage = signedImages[index * 2 + 1]
      if (frontImage?.error || backImage?.error) {
        const imageError = frontImage?.error ?? backImage?.error
        setError(`Requests loaded, but an uploaded design image could not be opened: ${imageError.message}`)
      }
      nextUrls[request.id] = {
        front: frontImage && !frontImage.error ? frontImage.data.signedUrl : undefined,
        back: backImage && !backImage.error ? backImage.data.signedUrl : undefined,
      }
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
              <div className="custom-request-images">
                {imageUrls[request.id]?.front && <a href={imageUrls[request.id].front} target="_blank" rel="noreferrer">VIEW FRONT DESIGN</a>}
                {imageUrls[request.id]?.back && <a href={imageUrls[request.id].back} target="_blank" rel="noreferrer">VIEW BACK DESIGN</a>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
