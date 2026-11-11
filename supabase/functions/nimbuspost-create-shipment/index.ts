import { createClient } from 'npm:@supabase/supabase-js@2'
import { hasPackageOverride, isValidParcel, type Parcel } from '../_shared/shipping-packages.ts'

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

const parseParcel = (value: unknown): Parcel | null => {
  if (!value || typeof value !== 'object') return null
  const parcel = value as Record<string, unknown>
  const parsed = {
    weightGrams: Number(parcel.weightGrams),
    lengthCm: Number(parcel.lengthCm),
    widthCm: Number(parcel.widthCm),
    heightCm: Number(parcel.heightCm),
  }
  return isValidParcel(parsed) ? parsed : null
}

const parseBooking = (value: unknown) => {
  if (!value || typeof value !== 'object') return null
  const body = value as {
    success?: unknown
    data?: { booking?: Record<string, unknown> }
    message?: unknown
    error?: unknown
  }
  const booking = body.data?.booking
  if (body.success !== true || !booking
    || typeof booking.order_id !== 'string'
    || typeof booking.awb !== 'string'
    || typeof booking.courier_name !== 'string') return null
  return { body, booking }
}

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
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Supabase is not configured for NimbusPost shipment booking.' }, 500)
  }
  if (!apiKey || !apiSecret) {
    return json({ error: 'NimbusPost credentials must be configured as Edge Function secrets.' }, 503)
  }

  let orderId: number
  let itemIds: number[]
  let parcelOverride: Parcel | null
  try {
    const body = await request.json() as { orderId?: unknown; itemIds?: unknown; parcel?: unknown }
    orderId = Number(body.orderId)
    if (!Array.isArray(body.itemIds) || body.itemIds.length === 0 || body.itemIds.length > 50) {
      return json({ error: 'Select at least one unshipped order item.' }, 400)
    }
    itemIds = body.itemIds.map(Number)
    if (itemIds.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(itemIds).size !== itemIds.length) {
      return json({ error: 'Invalid order item selection.' }, 400)
    }
    parcelOverride = body.parcel === undefined ? null : parseParcel(body.parcel)
    if (body.parcel !== undefined && !parcelOverride) {
      return json({ error: 'Enter valid parcel weight and dimensions.' }, 400)
    }
  } catch {
    return json({ error: 'Invalid NimbusPost shipment request.' }, 400)
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
    console.error('NimbusPost booking could not verify staff access.', { error: adminError.message })
    return json({ error: 'Could not verify administrator access.' }, 500)
  }
  if (!isAdmin) return json({ error: 'Administrator access is required.' }, 403)

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const [{ data: order, error: orderError }, { data: items, error: itemsError }, { data: packages, error: packagesError }] = await Promise.all([
    serviceClient
      .from('orders')
      .select('id, order_number, status, payment_method, shipping_address, shipping_pincode, shipping_fee_paise, cod_fee_paise, platform_fee_paise')
      .eq('id', orderId)
      .maybeSingle(),
    serviceClient
      .from('order_items')
      .select('id, warehouse_id, sku, title, size_label, quantity, line_total_paise, status, shipment_id')
      .eq('order_id', orderId)
      .in('id', itemIds),
    serviceClient
      .from('order_shipping_packages')
      .select('warehouse_id, package_preset_key, item_quantity, weight_grams, length_cm, width_cm, height_cm')
      .eq('order_id', orderId),
  ])
  if (orderError || itemsError || packagesError) {
    console.error('NimbusPost booking could not load order or package details.', {
      orderId,
      orderError: orderError?.message,
      itemsError: itemsError?.message,
      packagesError: packagesError?.message,
    })
    return json({ error: 'Could not load the order or shipping package settings.' }, 500)
  }
  if (!order || order.status !== 'placed') return json({ error: 'Only placed orders can be shipped.' }, 409)
  if (!items || items.length !== itemIds.length
    || items.some((item) => item.status !== 'placed' || item.shipment_id !== null)
    || new Set(items.map((item) => item.warehouse_id)).size !== 1) {
    return json({ error: 'Selected items must be unshipped items from the same warehouse.' }, 409)
  }

  const quantity = items.reduce((total, item) => total + item.quantity, 0)
  const orderPackage = (packages ?? []).find((item) => item.warehouse_id === items[0].warehouse_id)
  if (!orderPackage || orderPackage.item_quantity < quantity) {
    return json({ error: 'This order does not have a matching package preset. Refresh the order or contact support.' }, 409)
  }
  const defaultParcel: Parcel = {
    weightGrams: orderPackage.weight_grams,
    lengthCm: Number(orderPackage.length_cm),
    widthCm: Number(orderPackage.width_cm),
    heightCm: Number(orderPackage.height_cm),
  }
  if (!isValidParcel(defaultParcel)) return json({ error: 'The saved package preset is invalid.' }, 500)
  const parcel = parcelOverride ?? defaultParcel
  if (!isValidParcel(parcel)) return json({ error: 'Enter valid parcel weight and dimensions.' }, 400)

  const address = order.shipping_address as Record<string, unknown>
  const recipientName = String(address.name ?? '').trim()
  const phone = String(address.phone ?? '').replace(/\D/g, '')
  const deliveryPincode = String(order.shipping_pincode ?? address.pincode ?? '').trim()
  const city = String(address.city ?? '').trim()
  const state = String(address.state ?? '').trim()
  const addressLine = [address.line1, address.line2, address.landmark]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ')
  if (!recipientName || !/^\d{10}$/.test(phone) || !validPincode(deliveryPincode)
    || !city || !state || !addressLine) {
    return json({ error: 'The delivery address is missing a valid name, 10-digit phone, address, city, state or pincode.' }, 400)
  }

  const warehouseId = items[0].warehouse_id
  const [{ data: warehouse, error: warehouseError }, { data: existingShipments, error: shipmentError }] = await Promise.all([
    serviceClient.from('warehouses').select('code').eq('id', warehouseId).maybeSingle(),
    serviceClient.from('shipments').select('id').eq('order_id', orderId).limit(1),
  ])
  if (warehouseError || shipmentError) {
    console.error('NimbusPost booking could not load warehouse or shipment state.', {
      orderId,
      warehouseError: warehouseError?.message,
      shipmentError: shipmentError?.message,
    })
    return json({ error: 'Could not verify the pickup warehouse and shipment state.' }, 500)
  }
  if (!warehouse?.code) return json({ error: 'The order warehouse has no NimbusPost pickup code.' }, 500)

  const { data: reservation, error: reserveError } = await serviceClient.rpc('reserve_nimbuspost_shipment', {
    p_order_id: orderId,
    p_item_ids: itemIds,
  })
  if (reserveError || !Array.isArray(reservation) || !reservation[0]?.booking_id || !reservation[0]?.nimbuspost_order_number) {
    console.error('NimbusPost booking reservation could not be created.', {
      orderId,
      error: reserveError?.message ?? 'Reservation response was empty.',
    })
    return json({ error: reserveError?.message ?? 'A NimbusPost booking is already in progress or completed for these items.' }, 409)
  }
  const { booking_id: bookingId, nimbuspost_order_number: nimbusOrderNumber } = reservation[0]

  const rawAddress = address as Record<string, string | number | null>
  const payload: Record<string, unknown> = {
    order_number: nimbusOrderNumber,
    order_type: 'b2c',
    payment_mode: order.payment_method === 'cod' ? 'cod' : 'prepaid',
    warehouse_id: warehouse.code,
    shipping_address: {
      name: recipientName,
      ...(typeof rawAddress.email === 'string' && rawAddress.email.includes('@') ? { email: rawAddress.email } : {}),
      address: addressLine,
      pincode: Number(deliveryPincode),
      city,
      state,
      country: 'India',
      phone: Number(phone),
    },
    items: items.map((item) => ({
      name: `${item.title} · ${item.size_label}`,
      qty: item.quantity,
      price: item.line_total_paise / item.quantity / 100,
      sku: item.sku,
      tax_rate: 0,
    })),
    package: {
      weight: parcel.weightGrams / 1000,
      length: parcel.lengthCm,
      width: parcel.widthCm,
      height: parcel.heightCm,
    },
  }
  if (order.payment_method === 'cod') {
    let collectablePaise = items.reduce((total, item) => total + item.line_total_paise, 0)
    if (!existingShipments?.length) {
      collectablePaise += order.shipping_fee_paise + order.cod_fee_paise + order.platform_fee_paise
    }
    payload.order_collectable_amount = collectablePaise / 100
  }

  let upstream: Response
  try {
    upstream = await fetch('https://api-v2.nimbuspost.com/v2/shipments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-api-secret': apiSecret,
      },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    console.error('NimbusPost shipment request had an unknown outcome; reservation retained to prevent duplicate booking.', {
      orderId,
      nimbusOrderNumber,
      error,
    })
    return json({
      error: `NimbusPost could not confirm the response. Check order ${nimbusOrderNumber} in NimbusPost before retrying; duplicate booking is blocked.`,
    }, 502)
  }

  let upstreamBody: unknown
  try {
    upstreamBody = await upstream.json()
  } catch (error) {
    console.error('NimbusPost shipment response was not JSON; reservation retained.', {
      orderId,
      nimbusOrderNumber,
      status: upstream.status,
      error,
    })
    return json({
      error: `NimbusPost returned an unreadable response. Check order ${nimbusOrderNumber} in NimbusPost before retrying; duplicate booking is blocked.`,
    }, 502)
  }
  const parsedBooking = parseBooking(upstreamBody)
  if (!upstream.ok || !parsedBooking) {
    console.error('NimbusPost shipment booking was not confirmed; reservation retained.', {
      orderId,
      nimbusOrderNumber,
      status: upstream.status,
    })
    return json({
      error: `NimbusPost did not confirm the booking. Check order ${nimbusOrderNumber} in NimbusPost before retrying; duplicate booking is blocked.`,
    }, 502)
  }

  const { booking, body } = parsedBooking
  const { data: shipmentId, error: completeError } = await serviceClient.rpc('complete_nimbuspost_shipment', {
    p_booking_id: bookingId,
    p_nimbuspost_order_id: booking.order_id,
    p_courier: booking.courier_name,
    p_awb: booking.awb,
    p_tracking_url: typeof booking.tracking_url === 'string' ? booking.tracking_url : null,
    p_package_preset_key: orderPackage.package_preset_key,
    p_package_weight_grams: parcel.weightGrams,
    p_package_length_cm: parcel.lengthCm,
    p_package_width_cm: parcel.widthCm,
    p_package_height_cm: parcel.heightCm,
    p_package_overridden: hasPackageOverride(parcel, defaultParcel),
  })
  if (completeError) {
    console.error('NimbusPost booked the courier but the local shipment record could not be saved.', {
      orderId,
      nimbusOrderNumber,
      error: completeError.message,
    })
    return json({
      error: `NimbusPost booked the courier, but the store could not save the shipment. Do not retry; reconcile order ${nimbusOrderNumber} in NimbusPost.`,
    }, 500)
  }

  return json({ shipmentId, booking: body.data?.booking, package: parcel, preset: orderPackage.package_preset_key })
})
