import { createClient } from 'npm:@supabase/supabase-js@2'

type PayUFields = Record<string, string>

const sha512 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const safeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
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

const resultUrl = (storeUrl: string, orderId: number, state: 'success' | 'failed' | 'pending' | 'refunded') => {
  const base = new URL(storeUrl)
  base.hash = `checkout-result-${orderId}?state=${state}`
  return base.toString()
}

const redirect = (url: string, status = 303) =>
  new Response(null, { status, headers: { Location: url, 'Cache-Control': 'no-store' } })

const errorResponse = (message: string, status: number) =>
  new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

Deno.serve(async (request) => {
  if (request.method !== 'POST') return errorResponse('Method not allowed.', 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const storeUrl = Deno.env.get('STORE_URL')
  const environment = Deno.env.get('PAYU_ENV') ?? 'test'
  const merchantKey = Deno.env.get(environment === 'production' ? 'PAYU_LIVE_MERCHANT_KEY' : 'PAYU_MERCHANT_KEY')
  const merchantSalt = Deno.env.get(environment === 'production' ? 'PAYU_LIVE_MERCHANT_SALT' : 'PAYU_MERCHANT_SALT')
  if (!supabaseUrl || !serviceRoleKey || !merchantKey || !merchantSalt || !storeUrl) {
    return errorResponse('Payment service is not configured.', 500)
  }
  if (environment !== 'test' && environment !== 'production') {
    return errorResponse('Invalid PayU environment configuration.', 500)
  }

  let fields: PayUFields
  try {
    const form = await request.formData()
    fields = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]))
  } catch {
    return errorResponse('Invalid PayU response.', 400)
  }

  const { txnid, hash, status, key, amount, udf1, mihpayid, mode } = fields
  const callbackAmount = toPaise(amount ?? '')
  const orderId = Number(udf1)
  if (!txnid || !hash || !status || key !== merchantKey || !callbackAmount || !Number.isSafeInteger(orderId) || orderId <= 0) {
    return errorResponse('Incomplete PayU response.', 400)
  }

  const responseHashInput = fields.additionalCharges
    ? `${fields.additionalCharges}|${merchantSalt}|${status}||||||${fields.udf5 ?? ''}|${fields.udf4 ?? ''}|${fields.udf3 ?? ''}|${fields.udf2 ?? ''}|${udf1}|${fields.email ?? ''}|${fields.firstname ?? ''}|${fields.productinfo ?? ''}|${amount}|${txnid}|${key}`
    : `${merchantSalt}|${status}||||||${fields.udf5 ?? ''}|${fields.udf4 ?? ''}|${fields.udf3 ?? ''}|${fields.udf2 ?? ''}|${udf1}|${fields.email ?? ''}|${fields.firstname ?? ''}|${fields.productinfo ?? ''}|${amount}|${txnid}|${key}`
  const expectedHash = await sha512(responseHashInput)
  if (!safeEqual(hash.toLowerCase(), expectedHash)) return errorResponse('PayU response could not be verified.', 400)

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const [{ data: order, error: orderError }, { data: payment, error: paymentError }] = await Promise.all([
    supabase.from('orders').select('id, total_paise, status').eq('id', orderId).maybeSingle(),
    supabase
      .from('payments')
      .select('order_id, amount_paise, status')
      .eq('provider', 'payu')
      .eq('provider_order_id', txnid)
      .maybeSingle(),
  ])
  if (orderError || paymentError) return errorResponse('Could not verify the order.', 500)
  if (!order || !payment || payment.order_id !== order.id || payment.amount_paise !== order.total_paise) {
    return errorResponse('PayU response does not match an order.', 400)
  }
  if (payment.status === 'captured') {
    const state = order.status === 'placed' || order.status === 'completed' ? 'success' : 'refunded'
    return redirect(resultUrl(storeUrl, order.id, state))
  }
  const normalizedStatus = status.toLowerCase()
  if (normalizedStatus !== 'success' && normalizedStatus !== 'failure') {
    return redirect(resultUrl(storeUrl, order.id, 'pending'))
  }
  if (normalizedStatus === 'failure' && callbackAmount !== payment.amount_paise) {
    return redirect(resultUrl(storeUrl, order.id, 'pending'))
  }

  let method = paymentMethod(mode ?? '')
  let finalStatus: 'captured' | 'failed' = 'failed'
  let providerPaymentId = mihpayid || txnid
  let amountPaise = callbackAmount
  let raw: Record<string, string> = {
    status,
    txnid,
    mihpayid: mihpayid ?? '',
    mode: mode ?? '',
    amount,
  }

  if (normalizedStatus === 'success') {
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
    let verified: { status?: string; amount?: string; mihpayid?: string; mode?: string } | undefined
    try {
      const verifyResponse = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: verifyBody,
      })
      if (!verifyResponse.ok) return redirect(resultUrl(storeUrl, order.id, 'pending'))
      const verifyData = await verifyResponse.json() as {
        transaction_details?: Record<string, { status?: string; amount?: string; mihpayid?: string; mode?: string }>
      }
      verified = verifyData.transaction_details?.[txnid]
    } catch {
      return redirect(resultUrl(storeUrl, order.id, 'pending'))
    }
    const verifiedAmount = verified?.amount === undefined ? null : toPaise(String(verified.amount))
    if (verified?.status?.toLowerCase() !== 'success' || verifiedAmount === null || !verified.mihpayid) {
      return redirect(resultUrl(storeUrl, order.id, 'pending'))
    }
    finalStatus = 'captured'
    providerPaymentId = String(verified.mihpayid)
    amountPaise = verifiedAmount
    method = paymentMethod(verified.mode ?? mode ?? '')
    raw = {
      status: verified.status,
      txnid,
      mihpayid: verified.mihpayid,
      mode: verified.mode ?? mode ?? '',
      amount: verified.amount ?? amount,
    }
  }

  const { error: paymentUpdateError } = await supabase
    .from('payments')
    .update({ provider_payment_id: providerPaymentId, method, amount_paise: amountPaise })
    .eq('provider', 'payu')
    .eq('provider_order_id', txnid)
  if (paymentUpdateError) return errorResponse('Could not record the PayU payment.', 500)

  const { data: applied, error: applyError } = await supabase.rpc('apply_payment_webhook', {
    p_order_id: order.id,
    p_provider: 'payu',
    p_provider_order_id: txnid,
    p_provider_payment_id: providerPaymentId,
    p_method: method,
    p_amount_paise: amountPaise,
    p_status: finalStatus,
    p_raw: raw,
    p_error_code: finalStatus === 'failed' ? (fields.error ?? null) : null,
    p_error_reason: finalStatus === 'failed' ? (fields.error_Message ?? fields.error ?? null) : null,
  })
  if (applyError) return errorResponse('Could not finalize the payment.', 500)

  const confirmed = finalStatus === 'captured' && applied === 'placed'
  const alreadyConfirmed = finalStatus === 'captured' && applied === 'already_placed'
  const refunded = applied === 'amount_mismatch_refunded' || applied === 'late_payment_refunded' || applied === 'already_handled'
  const result = confirmed || alreadyConfirmed ? 'success' : refunded ? 'refunded' : 'failed'
  return redirect(resultUrl(storeUrl, order.id, result))
})
