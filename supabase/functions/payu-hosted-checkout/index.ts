import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const sha512 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const authorization = request.headers.get('Authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return json({ error: 'Please sign in before checkout.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const storeUrl = Deno.env.get('STORE_URL')
  const environment = Deno.env.get('PAYU_ENV') ?? 'test'
  const merchantKey = Deno.env.get(environment === 'production' ? 'PAYU_LIVE_MERCHANT_KEY' : 'PAYU_MERCHANT_KEY')
  const merchantSalt = Deno.env.get(environment === 'production' ? 'PAYU_LIVE_MERCHANT_SALT' : 'PAYU_MERCHANT_SALT')
  if (!supabaseUrl || !serviceRoleKey || !merchantKey || !merchantSalt || !storeUrl) {
    return json({ error: 'PayU checkout is not configured on the server.' }, 500)
  }
  if (environment !== 'test' && environment !== 'production') {
    return json({ error: 'PAYU_ENV must be "test" or "production".' }, 500)
  }

  let baseUrl: URL
  try {
    baseUrl = new URL(storeUrl)
  } catch {
    return json({ error: 'STORE_URL must be a valid public URL.' }, 500)
  }
  if (baseUrl.protocol !== 'https:' && baseUrl.hostname !== 'localhost') {
    return json({ error: 'STORE_URL must use HTTPS.' }, 500)
  }

  let orderId: number
  try {
    const body = await request.json() as { orderId?: unknown }
    orderId = Number(body.orderId)
  } catch {
    return json({ error: 'Invalid checkout request.' }, 400)
  }
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return json({ error: 'Invalid order.' }, 400)

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) return json({ error: 'Your session expired. Please sign in again.' }, 401)

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, status, total_paise, user_id, shipping_address')
    .eq('id', orderId)
    .eq('user_id', authData.user.id)
    .maybeSingle()
  if (orderError) return json({ error: 'Could not load your order.' }, 500)
  if (!order) return json({ error: 'Order not found.' }, 404)
  if (order.status !== 'pending_payment' || order.total_paise <= 0) {
    return json({ error: 'This order is not awaiting payment.' }, 409)
  }

  const shippingAddress = order.shipping_address as { name?: string; phone?: string } | null
  const firstName = shippingAddress?.name?.trim()
  const phone = shippingAddress?.phone?.replace(/\D/g, '')
  const email = authData.user.email?.trim()
  if (!firstName || !phone || !email) {
    return json({ error: 'Add your name, a valid phone number, and an email address before checkout.' }, 400)
  }

  const txnid = `D${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`
  const amount = (order.total_paise / 100).toFixed(2)
  const productinfo = `DUSKEO order ${order.order_number}`
  const callbackUrl = new URL('/functions/v1/payu-callback', supabaseUrl).toString()
  const udf1 = String(order.id)
  const hashInput = `${merchantKey}|${txnid}|${amount}|${productinfo}|${firstName}|${email}|${udf1}||||||||||${merchantSalt}`
  const hash = await sha512(hashInput)

  const { error: paymentError } = await supabase.from('payments').insert({
    order_id: order.id,
    provider: 'payu',
    provider_order_id: txnid,
    method: 'upi',
    amount_paise: order.total_paise,
    status: 'created',
  })
  if (paymentError?.code === '23505') {
    return json({ error: 'A payment attempt is already active for this order. Complete it or check your order status before trying again.' }, 409)
  }
  if (paymentError) return json({ error: 'Could not start payment. Please try again.' }, 500)

  return json({
    actionUrl: environment === 'production' ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment',
    fields: {
      key: merchantKey,
      txnid,
      amount,
      productinfo,
      firstname: firstName,
      email,
      phone,
      surl: callbackUrl,
      furl: callbackUrl,
      udf1,
      hash,
    },
  })
})
