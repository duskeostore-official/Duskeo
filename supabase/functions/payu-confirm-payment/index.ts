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

const toPaise = (amount: string) => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) return null
  const [rupees, fraction = ''] = amount.split('.')
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(paise) && paise > 0 ? paise : null
}

const paymentMethod = (mode: string): 'upi' | 'card' | 'netbanking' | 'wallet' => {
  const normalized = mode.toLowerCase()
  if (normalized.includes('upi')) return 'upi'
  if (['cc', 'dc'].includes(normalized) || normalized.includes('card') || normalized.includes('credit') || normalized.includes('debit')) return 'card'
  if (normalized.includes('wallet')) return 'wallet'
  return 'netbanking'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return json({ error: 'Please sign in to check this payment.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const environment = Deno.env.get('PAYU_ENV') ?? 'test'
  const merchantKey = Deno.env.get(environment === 'production' ? 'PAYU_LIVE_MERCHANT_KEY' : 'PAYU_MERCHANT_KEY')
  const merchantSalt = Deno.env.get(environment === 'production' ? 'PAYU_LIVE_MERCHANT_SALT' : 'PAYU_MERCHANT_SALT')
  if (!supabaseUrl || !serviceRoleKey || !merchantKey || !merchantSalt) {
    return json({ error: 'PayU payment verification is not configured.' }, 500)
  }
  if (environment !== 'test' && environment !== 'production') {
    return json({ error: 'Invalid PayU environment configuration.' }, 500)
  }

  let orderId: number
  try {
    const body = await request.json() as { orderId?: unknown }
    orderId = Number(body.orderId)
  } catch {
    return json({ error: 'Invalid payment verification request.' }, 400)
  }
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return json({ error: 'Invalid order.' }, 400)

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) return json({ error: 'Your session expired. Please sign in again.' }, 401)

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, total_paise')
    .eq('id', orderId)
    .eq('user_id', authData.user.id)
    .maybeSingle()
  if (orderError) return json({ error: 'Could not load your order.' }, 500)
  if (!order) return json({ error: 'Order not found.' }, 404)
  if (order.status === 'placed' || order.status === 'completed') return json({ status: 'confirmed' })

  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('provider_order_id, provider_payment_id, amount_paise, status')
    .eq('order_id', order.id)
    .eq('provider', 'payu')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (paymentError) return json({ error: 'Could not load your payment.' }, 500)
  if (!payment || payment.status === 'created' && !payment.provider_order_id) {
    return json({ status: order.status === 'cancelled' ? 'cancelled' : 'pending' })
  }
  if (payment.status === 'captured') return json({ status: 'confirmed' })
  if (payment.status === 'failed') return json({ status: 'failed' })

  const txnid = payment.provider_order_id
  const verifyUrl = environment === 'production'
    ? 'https://info.payu.in/merchant/postservice.php?form=2'
    : 'https://test.payu.in/merchant/postservice.php?form=2'
  const verifyHash = await sha512(`${merchantKey}|verify_payment|${txnid}|${merchantSalt}`)
  const verifyBody = new URLSearchParams({
    key: merchantKey,
    command: 'verify_payment',
    var1: txnid,
    hash: verifyHash,
  })

  let verifyData: {
    transaction_details?: Record<string, { status?: string; amount?: string; mihpayid?: string; mode?: string }>
  }
  try {
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyBody,
    })
    if (!response.ok) {
      console.error('PayU payment verification returned an unsuccessful HTTP status.', response.status)
      return json({ status: 'pending' })
    }
    verifyData = await response.json()
  } catch (error) {
    console.error('PayU payment verification request failed.', error)
    return json({ status: 'pending' })
  }

  const verified = verifyData.transaction_details?.[txnid]
  const normalizedStatus = verified?.status?.toLowerCase()
  if (normalizedStatus !== 'success') return json({ status: normalizedStatus === 'failure' ? 'failed' : 'pending' })

  const amountPaise = verified?.amount === undefined ? null : toPaise(String(verified.amount))
  if (amountPaise === null || !verified?.mihpayid) {
    console.error('PayU reported a successful payment without a verifiable amount or payment ID.')
    return json({ status: 'pending' })
  }

  const method = paymentMethod(verified.mode ?? '')
  const { error: updateError } = await supabase
    .from('payments')
    .update({
      provider_payment_id: String(verified.mihpayid),
      method,
      amount_paise: amountPaise,
    })
    .eq('provider', 'payu')
    .eq('provider_order_id', txnid)
  if (updateError) return json({ error: 'Could not record the PayU payment.' }, 500)

  const { data: applied, error: applyError } = await supabase.rpc('apply_payment_webhook', {
    p_order_id: order.id,
    p_provider: 'payu',
    p_provider_order_id: txnid,
    p_provider_payment_id: String(verified.mihpayid),
    p_method: method,
    p_amount_paise: amountPaise,
    p_status: 'captured',
    p_raw: {
      status: verified.status ?? '',
      txnid,
      mihpayid: String(verified.mihpayid),
      mode: verified.mode ?? '',
      amount: verified.amount ?? '',
    },
  })
  if (applyError) return json({ error: 'Could not finalize the PayU payment.' }, 500)

  if (applied === 'placed' || applied === 'already_placed') return json({ status: 'confirmed' })
  if (applied === 'amount_mismatch_refunded' || applied === 'late_payment_refunded' || applied === 'already_handled') {
    return json({ status: 'refunded' })
  }
  return json({ status: 'pending' })
})
