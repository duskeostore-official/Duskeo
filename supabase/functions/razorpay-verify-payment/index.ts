import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0'
import {
  corsHeaders,
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const authorization = request.headers.get('Authorization')
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!authorization || !accessToken) return jsonResponse({ error: 'Please sign in to verify payment.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase is not configured on the server.' }, 500)
  }

  try {
    const body = await request.json() as {
      orderId?: unknown
      razorpayOrderId?: unknown
      razorpayPaymentId?: unknown
      razorpaySignature?: unknown
    }
    const internalOrderId = Number(body.orderId)
    const razorpayOrderId = typeof body.razorpayOrderId === 'string' ? body.razorpayOrderId : ''
    const razorpayPaymentId = typeof body.razorpayPaymentId === 'string' ? body.razorpayPaymentId : ''
    const razorpaySignature = typeof body.razorpaySignature === 'string' ? body.razorpaySignature : ''
    if (!Number.isSafeInteger(internalOrderId) || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return jsonResponse({ error: 'The payment response is incomplete.' }, 400)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    })
    const { data: userResult, error: userError } = await userClient.auth.getUser(accessToken)
    if (userError || !userResult.user) return jsonResponse({ error: 'Your session expired. Please sign in again.' }, 401)

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: order, error: orderError } = await serviceClient
      .from('orders')
      .select('id, user_id, order_number, total_paise, status')
      .eq('id', internalOrderId)
      .eq('user_id', userResult.user.id)
      .maybeSingle()
    if (orderError || !order) return jsonResponse({ error: 'Order not found.' }, 404)

    const credentials = razorpayCredentials()
    const expectedSignature = await hmacSha256Hex(credentials.keySecret, `${razorpayOrderId}|${razorpayPaymentId}`)
    if (!secureHexEqual(expectedSignature, razorpaySignature)) {
      return jsonResponse({ error: 'Razorpay payment signature could not be verified.' }, 401)
    }

    const razorpayOrder = await razorpayRequest<RazorpayOrder>(credentials, `orders/${encodeURIComponent(razorpayOrderId)}`)
    if (
      razorpayOrder.notes?.internal_order_id !== String(order.id) ||
      razorpayOrder.notes?.user_id !== userResult.user.id ||
      razorpayOrder.amount !== order.total_paise ||
      razorpayOrder.currency !== 'INR'
    ) {
      return jsonResponse({ error: 'Razorpay order does not match this checkout.' }, 409)
    }

    const payment = await razorpayRequest<RazorpayPayment>(credentials, `payments/${encodeURIComponent(razorpayPaymentId)}`)
    if (payment.order_id !== razorpayOrderId || payment.currency !== 'INR') {
      return jsonResponse({ error: 'Razorpay payment does not match this order.' }, 409)
    }
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return jsonResponse({ error: 'Razorpay has not authorized this payment yet.' }, 409)
    }

    const paymentStatus = payment.status as 'captured' | 'authorized'
    const { data: result, error: applyError } = await serviceClient.rpc('apply_payment_webhook', {
      p_order_id: order.id,
      p_provider: 'razorpay',
      p_provider_order_id: razorpayOrderId,
      p_provider_payment_id: razorpayPaymentId,
      p_method: paymentMethod(payment.method),
      p_amount_paise: payment.amount,
      p_status: paymentStatus,
      p_raw: payment,
      p_error_code: payment.error_code ?? null,
      p_error_reason: payment.error_description ?? null,
    })
    if (applyError) return jsonResponse({ error: applyError.message }, 500)

    return jsonResponse({
      ok: true,
      orderId: order.id,
      orderNumber: order.order_number,
      result,
      paymentStatus,
    })
  } catch (error) {
    return jsonResponse({ error: errorMessage(error) }, 500)
  }
})