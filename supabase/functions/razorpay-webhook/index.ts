import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0'
import {
  errorMessage,
  hmacSha256Hex,
  jsonResponse,
  paymentMethod,
  razorpayCredentials,
  razorpayRequest,
  secureHexEqual,
  type RazorpayOrder,
  type RazorpayPayment,
} from '../_shared/razorpay.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve: (handler: (request: Request) => Response | Promise<Response>) => void
}

interface WebhookEvent {
  event?: string
  payload?: { payment?: { entity?: RazorpayPayment } }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok')
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  try {
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
    const signature = request.headers.get('x-razorpay-signature') || ''
    if (!webhookSecret || !signature) return jsonResponse({ error: 'Missing webhook signature.' }, 401)

    const rawBody = await request.text()
    const expectedSignature = await hmacSha256Hex(webhookSecret, rawBody)
    if (!secureHexEqual(expectedSignature, signature)) return jsonResponse({ error: 'Invalid webhook signature.' }, 401)

    const event = JSON.parse(rawBody) as WebhookEvent
    const payment = event.payload?.payment?.entity
    if (!payment?.id || !payment.order_id) return jsonResponse({ received: true, ignored: true })

    const paymentStatus = event.event === 'payment.captured'
      ? 'captured'
      : event.event === 'payment.authorized'
        ? 'authorized'
        : event.event === 'payment.failed'
          ? 'failed'
          : null
    if (!paymentStatus) return jsonResponse({ received: true, ignored: true })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase is not configured on the server.')

    const credentials = razorpayCredentials()
    const razorpayOrder = await razorpayRequest<RazorpayOrder>(
      credentials,
      `orders/${encodeURIComponent(payment.order_id)}`,
    )
    const internalOrderId = Number(razorpayOrder.notes?.internal_order_id)
    if (!Number.isSafeInteger(internalOrderId)) throw new Error('Razorpay order is missing its internal order reference.')

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: order, error: orderError } = await serviceClient
      .from('orders')
      .select('id, user_id, total_paise')
      .eq('id', internalOrderId)
      .maybeSingle()
    if (orderError || !order) throw new Error('Referenced DUSKEO order was not found.')
    if (
      razorpayOrder.notes?.user_id !== order.user_id ||
      razorpayOrder.amount !== order.total_paise ||
      payment.currency !== 'INR'
    ) {
      throw new Error('Razorpay webhook does not match the DUSKEO order.')
    }

    const { data: result, error: applyError } = await serviceClient.rpc('apply_payment_webhook', {
      p_order_id: order.id,
      p_provider: 'razorpay',
      p_provider_order_id: payment.order_id,
      p_provider_payment_id: payment.id,
      p_method: paymentMethod(payment.method),
      p_amount_paise: payment.amount,
      p_status: paymentStatus,
      p_raw: event,
      p_error_code: payment.error_code ?? null,
      p_error_reason: payment.error_description ?? null,
    })
    if (applyError) throw new Error(applyError.message)

    return jsonResponse({ received: true, result })
  } catch (error) {
    console.error('Razorpay webhook processing failed:', errorMessage(error))
    return jsonResponse({ error: errorMessage(error) }, 500)
  }
})