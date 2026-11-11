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

const validPincode = (value: string) => /^[1-9]\d{5}$/.test(value)

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return json({ error: 'Please sign in as an administrator.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const apiKey = Deno.env.get('NIMBUSPOST_API_KEY')
  const apiSecret = Deno.env.get('NIMBUSPOST_API_SECRET')
  const pickupPincode = Deno.env.get('NIMBUSPOST_PICKUP_PINCODE')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Supabase is not configured for NimbusPost rate checks.' }, 500)
  }
  if (!apiKey || !apiSecret || !pickupPincode) {
    return json({ error: 'NimbusPost credentials and pickup pincode must be configured as Edge Function secrets.' }, 503)
  }
  if (!validPincode(pickupPincode)) return json({ error: 'NimbusPost pickup pincode configuration is invalid.' }, 500)

  let orderId: number
  let itemIds: number[]
  let parcel: { weightGrams: number; lengthCm: number; widthCm: number; heightCm: number }
  try {
    const body = await request.json() as {
      orderId?: unknown
      itemIds?: unknown
      parcel?: {
        weightGrams?: unknown
        lengthCm?: unknown
        widthCm?: unknown
        heightCm?: unknown
      }
    }
    orderId = Number(body.orderId)
    if (!Array.isArray(body.itemIds) || body.itemIds.length === 0 || body.itemIds.length > 50) {
      return json({ error: 'Select at least one unshipped order item.' }, 400)
    }
    itemIds = body.itemIds.map(Number)
    if (itemIds.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(itemIds).size !== itemIds.length) {
      return json({ error: 'Invalid order item selection.' }, 400)
    }
    const weightGrams = Number(body.parcel?.weightGrams)
    const lengthCm = Number(body.parcel?.lengthCm)
    const widthCm = Number(body.parcel?.widthCm)
    const heightCm = Number(body.parcel?.heightCm)
    if (![weightGrams, lengthCm, widthCm, heightCm].every(Number.isFinite)
      || weightGrams <= 0 || weightGrams > 50000
      || [lengthCm, widthCm, heightCm].some((value) => value <= 0 || value > 200)) {
      return json({ error: 'Enter valid parcel weight and dimensions.' }, 400)
    }
    parcel = { weightGrams, lengthCm, widthCm, heightCm }
  } catch {
    return json({ error: 'Invalid NimbusPost rate-check request.' }, 400)
  }
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return json({ error: 'Invalid order.' }, 400)

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'Your session expired. Please sign in again.' }, 401)
  const { data: isAdmin, error: adminError } = await userClient.rpc('is_admin')
  if (adminError) {
    console.error('NimbusPost rate check could not verify staff access.', { error: adminError.message })
    return json({ error: 'Could not verify administrator access.' }, 500)
  }
  if (!isAdmin) return json({ error: 'Administrator access is required.' }, 403)

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const [{ data: order, error: orderError }, { data: items, error: itemsError }] = await Promise.all([
    serviceClient
      .from('orders')
      .select('id, status, payment_method, shipping_pincode')
      .eq('id', orderId)
      .maybeSingle(),
    serviceClient
      .from('order_items')
      .select('id, warehouse_id, line_total_paise, status, shipment_id')
      .eq('order_id', orderId)
      .in('id', itemIds),
  ])
  if (orderError || itemsError) {
    console.error('NimbusPost rate check could not load order details.', {
      orderId,
      orderError: orderError?.message,
      itemsError: itemsError?.message,
    })
    return json({ error: 'Could not load the order for rate checking.' }, 500)
  }
  if (!order || order.status !== 'placed') return json({ error: 'Only placed orders can be rate checked.' }, 409)
  if (!items || items.length !== itemIds.length
    || items.some((item) => item.status !== 'placed' || item.shipment_id !== null)
    || new Set(items.map((item) => item.warehouse_id)).size !== 1) {
    return json({ error: 'Selected items must be unshipped items from the same warehouse.' }, 409)
  }
  const deliveryPincode = String(order.shipping_pincode).trim()
  if (!validPincode(deliveryPincode)) return json({ error: 'The order has an invalid delivery pincode.' }, 400)

  let upstream: Response
  try {
    upstream = await fetch('https://api-v2.nimbuspost.com/v2/serviceability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-api-secret': apiSecret,
      },
      body: JSON.stringify({
        pickupPincode,
        deliveryPincode,
        paymentMode: order.payment_method === 'cod' ? 'cod' : 'prepaid',
        packages: [{
          weight: parcel.weightGrams,
          length: parcel.lengthCm,
          width: parcel.widthCm,
          height: parcel.heightCm,
        }],
        orderValuePaise: items.reduce((total, item) => total + item.line_total_paise, 0),
      }),
    })
  } catch (error) {
    console.error('NimbusPost serviceability request failed.', { orderId, error })
    return json({ error: 'Could not reach NimbusPost. Please try again.' }, 502)
  }

  let result: unknown
  try {
    result = await upstream.json()
  } catch {
    console.error('NimbusPost returned a non-JSON serviceability response.', { orderId, status: upstream.status })
    return json({ error: 'NimbusPost returned an invalid response.' }, 502)
  }
  if (!upstream.ok) {
    console.error('NimbusPost serviceability request was rejected.', { orderId, status: upstream.status })
    return json({ error: 'NimbusPost could not calculate rates for this parcel.' }, 502)
  }
  return json({ result })
})
