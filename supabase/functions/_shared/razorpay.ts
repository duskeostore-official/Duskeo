declare const Deno: { env: { get(name: string): string | undefined } }

export interface RazorpayCredentials {
  keyId: string
  keySecret: string
}

export interface RazorpayOrder {
  id: string
  amount: number
  currency: string
  notes?: Record<string, string>
}

export interface RazorpayPayment {
  id: string
  order_id: string | null
  amount: number
  currency: string
  method: string
  status: string
  error_code?: string | null
  error_description?: string | null
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function razorpayCredentials(): RazorpayCredentials {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID')
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
  if (!keyId || !keySecret) throw new Error('Razorpay is not configured on the server.')
  return { keyId, keySecret }
}

export async function razorpayRequest<T>(
  credentials: RazorpayCredentials,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Basic ${btoa(`${credentials.keyId}:${credentials.keySecret}`)}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(`https://api.razorpay.com/v1/${path}`, { ...init, headers })
  const payload = await response.json().catch(() => null) as {
    error?: { description?: string }
  } | null

  if (!response.ok) {
    throw new Error(payload?.error?.description || `Razorpay request failed (${response.status}).`)
  }
  return payload as T
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)))
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function secureHexEqual(left: string, right: string): boolean {
  if (!/^[\da-f]+$/i.test(left) || !/^[\da-f]+$/i.test(right) || left.length !== right.length) return false
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return mismatch === 0
}

export function paymentMethod(value: string): 'upi' | 'card' | 'netbanking' | 'wallet' {
  if (value === 'upi' || value === 'netbanking' || value === 'wallet') return value
  if (value === 'paylater') return 'wallet'
  return 'card'
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected payment error.'
}