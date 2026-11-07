export interface RazorpayPaymentResult {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

export interface RazorpayPaymentFailure {
  error?: {
    description?: string
    reason?: string
  }
}

export interface RazorpayCheckoutOptions {
  key: string
  amount: number
  currency: 'INR'
  name: string
  description: string
  order_id: string
  prefill?: { name?: string; email?: string; contact?: string }
  handler: (result: RazorpayPaymentResult) => void
  modal?: { ondismiss?: () => void }
}

export interface RazorpayCheckoutInstance {
  open: () => void
  on: (event: 'payment.failed', handler: (response: RazorpayPaymentFailure) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayCheckoutInstance
  }
}

const SCRIPT_ID = 'razorpay-checkout-script'
let scriptPromise: Promise<boolean> | null = null

export function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true)
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(Boolean(window.Razorpay))
    script.onerror = () => {
      scriptPromise = null
      resolve(false)
    }
    document.head.appendChild(script)
  })

  return scriptPromise
}