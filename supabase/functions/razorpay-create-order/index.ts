import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0'
import { corsHeaders, errorMessage, jsonResponse, razorpayCredentials, razorpayRequest, type RazorpayOrder } from '../_shared/razorpay.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve: (handler: (request: Request) => Response | Promise<Response>) => void
}

interface PlaceOrderResult {
  order_id: number
  order_number: string
  payable_paise: number
  status: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const authorization = request.headers.get('Authorization')
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!authorization || !accessToken) return jsonResponse({ error: 'Please sign in to check out.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return jsonResponse({ error: 'Supabase is not configured on the server.' }, 500)

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  })
  const { data: userResult, error: userError } = await userClient.auth.getUser(accessToken)
  if (userError || !userResult.user) return jsonResponse({ error: 'Your session expired. Please sign in again.' }, 401)

  let addressId: number
  try {
    const body = await request.json() as { addressId?: unknown }
    addressId = Number(body.addressId)
  } catch {
    return jsonResponse({ error: 'Invalid checkout request.' }, 400)
  }
  if (!Number.isSafeInteger(addressId) || addressId < 1) return jsonResponse({ error: 'Choose a delivery address.' }, 400)

  let internalOrderId: number | null = null
  try {
    const { data, error } = await userClient.rpc('place_order', {
      p_address_id: addressId,
      p_payment_method: 'upi',
      p_coupon_code: null,
      p_use_store_credit: false,
    })
    if (error) return jsonResponse({ error: error.message }, 400)

    const order = (Array.isArray(data) ? data[0] : data) as PlaceOrderResult | null
    if (!order) return jsonResponse({ error: 'Could not create your order.' }, 500)
    internalOrderId = Number(order.order_id)
    const amount = Number(order.payable_paise)
    if (!Number.isSafeInteger(internalOrderId) || !Number.isSafeInteger(amount)) {
      throw new Error('The order total is invalid.')
    }
    if (order.status !== 'pending_payment') {
      return jsonResponse({ requiresPayment: false, orderId: internalOrderId, orderNumber: order.order_number, status: order.status })
    }
    if (amount <= 0) throw new Error('The order total must be greater than zero for online payment.')

    const credentials = razorpayCredentials()
    const razorpayOrder = await razorpayRequest<RazorpayOrder>(credentials, 'orders', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt: order.order_number.slice(0, 40),
        notes: {
          internal_order_id: String(internalOrderId),
          user_id: userResult.user.id,
        },
      }),
    })

    if (razorpayOrder.amount !== amount || razorpayOrder.currency !== 'INR') {
      throw new Error('Razorpay returned an unexpected order amount.')
    }

    return jsonResponse({
      requiresPayment: true,
      orderId: internalOrderId,
      orderNumber: order.order_number,
      amountPaise: amount,
      currency: 'INR',
      razorpayOrderId: razorpayOrder.id,
      keyId: credentials.keyId,
    })
  } catch (error) {
    if (internalOrderId !== null) {
      const { error: cancelError } = await userClient.rpc('cancel_order', {
        p_order_id: internalOrderId,
        p_reason: 'Razorpay order creation failed',
      })
      if (cancelError) console.error('Unable to cancel the unpaid checkout order:', cancelError.message)
    }
    return jsonResponse({ error: errorMessage(error) }, 502)
  }
})