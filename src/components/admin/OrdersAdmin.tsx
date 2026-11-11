import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BRAND_NAME, CONTACT_EMAIL } from '../../constants/site'
import { supabase } from '../../lib/supabase'
import { formatDateTime, ITEM_STATUS, ORDER_STATUS } from '../../utils/orders'
import { rupees } from '../../utils/format'
import { validateShippingPackage, type PackagePresetKey, type ShippingPackage, type ShippingPackagePreset } from '../../utils/shippingPackages'

interface AdminOrder {
  id: number
  order_number: string
  status: keyof typeof ORDER_STATUS
  payment_method: string
  shipping_address: Record<string, string | null>
  item_count: number
  total_mrp_paise: number
  product_discount_paise: number
  coupon_code: string | null
  coupon_discount_paise: number
  shipping_fee_paise: number
  cod_fee_paise: number
  platform_fee_paise: number
  store_credit_used_paise: number
  tax_paise: number
  total_paise: number
  created_at: string
}

interface AdminOrderItem {
  id: number
  order_id: number
  warehouse_id: number
  shipment_id: number | null
  title: string
  sku: string
  size_label: string
  color_name: string
  quantity: number
  unit_price_paise: number
  line_total_paise: number
  status: string
}

interface OrderShippingPackage {
  order_id: number
  warehouse_id: number
  package_preset_key: PackagePresetKey
  item_quantity: number
  weight_grams: number
  length_cm: number
  width_cm: number
  height_cm: number
}

type ShipmentStatus = 'created' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'lost'

interface AdminShipment {
  id: number
  order_id: number
  courier: string | null
  awb_number: string | null
  tracking_url: string | null
  package_preset_key: string | null
  package_weight_grams: number | null
  package_length_cm: number | null
  package_width_cm: number | null
  package_height_cm: number | null
  package_overridden: boolean
  nimbuspost_order_id: string | null
  status: ShipmentStatus
  created_at: string
}

const PAGE_SIZE = 25
const ORDER_COLUMNS = 'id, order_number, status, payment_method, shipping_address, item_count, total_mrp_paise, product_discount_paise, coupon_code, coupon_discount_paise, shipping_fee_paise, cod_fee_paise, platform_fee_paise, store_credit_used_paise, tax_paise, total_paise, created_at'
const ITEM_COLUMNS = 'id, order_id, warehouse_id, shipment_id, title, sku, size_label, color_name, quantity, unit_price_paise, line_total_paise, status'
const SHIPMENT_COLUMNS = 'id, order_id, courier, awb_number, tracking_url, package_preset_key, package_weight_grams, package_length_cm, package_width_cm, package_height_cm, package_overridden, nimbuspost_order_id, status, created_at'
const NEXT_SHIPMENT_STATUSES: Partial<Record<ShipmentStatus, ShipmentStatus[]>> = {
  created: ['picked_up'],
  picked_up: ['in_transit', 'out_for_delivery'],
  in_transit: ['out_for_delivery'],
  out_for_delivery: ['delivered', 'lost'],
}

export function OrdersAdmin() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [items, setItems] = useState<AdminOrderItem[]>([])
  const [orderPackages, setOrderPackages] = useState<OrderShippingPackage[]>([])
  const [shipments, setShipments] = useState<AdminShipment[]>([])
  const [packagePresets, setPackagePresets] = useState<ShippingPackagePreset[]>([])
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<number>>(() => new Set())
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [printingOrderId, setPrintingOrderId] = useState<number | null>(null)

  useEffect(() => {
    const clearPrintedOrder = () => setPrintingOrderId(null)
    window.addEventListener('afterprint', clearPrintedOrder)
    return () => window.removeEventListener('afterprint', clearPrintedOrder)
  }, [])

  const loadOrders = useCallback(async (refresh = false) => {
    setError('')
    if (refresh) setRefreshing(true)
    else setLoading(true)

    const { data: presetRows, error: presetError } = await supabase
      .from('shipping_package_presets')
      .select('preset_key, label, min_quantity, max_quantity, weight_grams, length_cm, width_cm, height_cm')
      .order('min_quantity')
    if (presetError) {
      setError(`Could not load shipping package settings: ${presetError.message}`)
      setLoading(false)
      setRefreshing(false)
      return
    }
    setPackagePresets((presetRows ?? []) as ShippingPackagePreset[])

    const term = query.trim().replace(/[,().%_*\\"]/g, '')
    let orderQuery = supabase
      .from('orders')
      .select(ORDER_COLUMNS, { count: 'exact' })
      .eq('status', 'placed')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (term) {
      orderQuery = orderQuery.or(
        `order_number.ilike.%${term}%,shipping_address->>name.ilike.%${term}%,shipping_address->>phone.ilike.%${term}%,shipping_address->>city.ilike.%${term}%,shipping_address->>pincode.ilike.%${term}%`,
      )
    }

    const { data: orderRows, error: orderError, count } = await orderQuery

    if (orderError) {
      setError(`Could not load orders: ${orderError.message}`)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const loadedOrders = (orderRows ?? []) as AdminOrder[]
    const orderIds = loadedOrders.map((order) => order.id)
    let loadedItems: AdminOrderItem[] = []
    let loadedShipments: AdminShipment[] = []
    let loadedPackages: OrderShippingPackage[] = []

    if (orderIds.length) {
      const [itemResult, shipmentResult, packageResult] = await Promise.all([
        supabase.from('order_items').select(ITEM_COLUMNS).in('order_id', orderIds).order('id'),
        supabase.from('shipments').select(SHIPMENT_COLUMNS).in('order_id', orderIds).order('created_at'),
        supabase.from('order_shipping_packages')
          .select('order_id, warehouse_id, package_preset_key, item_quantity, weight_grams, length_cm, width_cm, height_cm')
          .in('order_id', orderIds),
      ])

      if (itemResult.error) {
        setError(`Orders loaded, but their items could not be loaded: ${itemResult.error.message}`)
        setLoading(false)
        setRefreshing(false)
        return
      }
      if (shipmentResult.error) {
        setError(`Orders loaded, but shipment details could not be loaded: ${shipmentResult.error.message}`)
        setLoading(false)
        setRefreshing(false)
        return
      }
      if (packageResult.error) {
        setError(`Orders loaded, but their saved package presets could not be loaded: ${packageResult.error.message}`)
        setLoading(false)
        setRefreshing(false)
        return
      }

      loadedItems = (itemResult.data ?? []) as AdminOrderItem[]
      loadedShipments = (shipmentResult.data ?? []) as AdminShipment[]
      loadedPackages = (packageResult.data ?? []) as OrderShippingPackage[]
    }

    setOrders(loadedOrders)
    setItems(loadedItems)
    setShipments(loadedShipments)
    setOrderPackages(loadedPackages)
    setTotalOrders(count ?? 0)
    setLoading(false)
    setRefreshing(false)
  }, [page, query])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadOrders(), 0)
    return () => window.clearTimeout(initialLoad)
  }, [loadOrders])

  const itemsByOrder = useMemo(() => {
    const grouped = new Map<number, AdminOrderItem[]>()
    items.forEach((item) => grouped.set(item.order_id, [...(grouped.get(item.order_id) ?? []), item]))
    return grouped
  }, [items])

  const shipmentsByOrder = useMemo(() => {
    const grouped = new Map<number, AdminShipment[]>()
    shipments.forEach((shipment) => grouped.set(shipment.order_id, [...(grouped.get(shipment.order_id) ?? []), shipment]))
    return grouped
  }, [shipments])

  const packageByOrderWarehouse = useMemo(() => {
    const packages = new Map<string, OrderShippingPackage>()
    orderPackages.forEach((item) => packages.set(`${item.order_id}-${item.warehouse_id}`, item))
    return packages
  }, [orderPackages])

  const saveTracking = async (shipmentId: number, courier: string, awb: string, trackingUrl: string) => {
    const cleanCourier = courier.trim()
    const cleanAwb = awb.trim()
    const cleanTrackingUrl = trackingUrl.trim()
    if (!cleanCourier || !cleanAwb) return 'Enter both courier and tracking number.'
    if (cleanTrackingUrl && !/^https?:\/\/\S+$/i.test(cleanTrackingUrl)) return 'Enter a valid http or https tracking URL.'

    const { error: updateError } = await supabase
      .from('shipments')
      .update({ courier: cleanCourier, awb_number: cleanAwb, tracking_url: cleanTrackingUrl || null })
      .eq('id', shipmentId)
    if (updateError) return `Could not save tracking details: ${updateError.message}`
    await loadOrders(true)
    return ''
  }

  const advanceShipment = async (shipmentId: number, status: ShipmentStatus) => {
    setError('')
    const { error: updateError } = await supabase.rpc('update_shipment_status', {
      p_shipment_id: shipmentId,
      p_status: status,
      p_event: null,
    })
    if (updateError) {
      setError(`Could not update shipment status: ${updateError.message}`)
      return
    }
    await loadOrders(true)
  }

  const printOrder = (orderId: number) => {
    setPrintingOrderId(orderId)
    window.setTimeout(() => {
      window.print()
      setPrintingOrderId(null)
    }, 0)
  }

  return (
    <section className="orders-admin" aria-labelledby="admin-orders-heading">
      <div className="orders-admin-head">
        <div>
          <h3 id="admin-orders-heading">PLACED ORDERS</h3>
          <p>{totalOrders} order{totalOrders === 1 ? '' : 's'}{query.trim() ? ' matching your search' : ''}</p>
        </div>
        <button type="button" onClick={() => void loadOrders(true)} disabled={loading || refreshing}>
          {refreshing ? 'REFRESHING…' : 'REFRESH'}
        </button>
      </div>

      <label className="orders-admin-search">
        SEARCH ORDERS
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setPage(0)
            setQuery(event.target.value)
          }}
          placeholder="Order number, customer, phone or city"
        />
      </label>

      {error && <p className="orders-admin-error" role="alert">{error}</p>}
      {loading ? (
        <p className="orders-admin-message" role="status">Loading orders…</p>
      ) : !totalOrders ? (
        <p className="orders-admin-message">No orders found.</p>
      ) : !orders.length ? (
        <p className="orders-admin-message">No orders found on this page.</p>
      ) : (
        <div className="orders-admin-list">
          {orders.map((order) => {
            const address = order.shipping_address
            const orderItems = itemsByOrder.get(order.id) ?? []
            const orderShipments = shipmentsByOrder.get(order.id) ?? []
            const orderExpanded = expandedOrderIds.has(order.id)
            const unshippedGroups = new Map<number, AdminOrderItem[]>()
            orderItems
              .filter((item) => item.status === 'placed' && item.shipment_id === null)
              .forEach((item) => unshippedGroups.set(item.warehouse_id, [...(unshippedGroups.get(item.warehouse_id) ?? []), item]))
            return (
              <details
                className="orders-admin-card"
                key={order.id}
                onToggle={(event) => {
                  const expanded = event.currentTarget.open
                  setExpandedOrderIds((current) => {
                    const next = new Set(current)
                    if (expanded) next.add(order.id)
                    else next.delete(order.id)
                    return next
                  })
                }}
              >
                <summary>
                  <span className="orders-admin-number">{order.order_number}</span>
                  <span>{address.name || 'Customer'}</span>
                  <span className="orders-admin-status">{ORDER_STATUS[order.status] ?? order.status}</span>
                  <span>{rupees(order.total_paise / 100)}</span>
                  <span className="orders-admin-date">{formatDateTime(order.created_at)}</span>
                </summary>
                <div className="orders-admin-details">
                  <div className="orders-admin-customer">
                    <strong>DELIVERY ADDRESS</strong>
                    <span>{address.name || '—'}{address.phone ? ` · ${address.phone}` : ''}</span>
                    <span>{[address.line1, address.line2, address.landmark].filter(Boolean).join(', ') || '—'}</span>
                    <span>{[address.city, address.state, address.pincode].filter(Boolean).join(', ')}</span>
                    <span>Payment: {order.payment_method.replaceAll('_', ' ')}</span>
                  </div>
                  <div className="orders-admin-items">
                    <strong>ITEMS ({order.item_count})</strong>
                    {orderItems.length ? orderItems.map((item) => (
                      <div className="orders-admin-item" key={item.id}>
                        <span>{item.title} · {item.size_label}{item.color_name ? ` · ${item.color_name}` : ''} × {item.quantity}<small>SKU {item.sku}{item.shipment_id ? ` · Shipment #${item.shipment_id}` : ''}</small></span>
                        <span>{ITEM_STATUS[item.status] ?? item.status.replaceAll('_', ' ')}</span>
                        <span>{rupees(item.line_total_paise / 100)}</span>
                      </div>
                    )) : <span className="orders-admin-message">No item details available.</span>}
                  </div>
                </div>
                {orderExpanded && (unshippedGroups.size > 0 || orderShipments.length > 0) && (
                  <div className="orders-admin-fulfillment">
                    <strong>FULFILLMENT & TRACKING</strong>
                    {[...unshippedGroups.entries()].map(([warehouseId, warehouseItems]) => (
                      <div key={`${order.id}-${warehouseId}`}>
                        <NimbusPostFulfillment
                          key={`${warehouseId}-${warehouseItems.map((item) => item.id).join('-')}`}
                          orderId={order.id}
                          packageDefault={packageByOrderWarehouse.get(`${order.id}-${warehouseId}`) ?? null}
                          presetLabel={packagePresets.find((preset) => preset.preset_key === packageByOrderWarehouse.get(`${order.id}-${warehouseId}`)?.package_preset_key)?.label ?? 'PACKAGE PRESET'}
                          items={warehouseItems}
                          onCreated={() => loadOrders(true)}
                        />
                      </div>
                    ))}
                    {orderShipments.map((shipment) => (
                      <ShipmentEditor
                        key={`${shipment.id}-${shipment.status}`}
                        shipment={shipment}
                        onSave={(courier, awb, url) => saveTracking(shipment.id, courier, awb, url)}
                        onAdvance={(status) => advanceShipment(shipment.id, status)}
                      />
                    ))}
                  </div>
                )}
                <div className="orders-admin-print-actions">
                  <button type="button" onClick={() => printOrder(order.id)}>PRINT RECEIPT</button>
                </div>
                {printingOrderId === order.id && (
                  <article className="admin-order-receipt" aria-label={`Receipt for ${order.order_number}`}>
                    <header>
                      <h1>{BRAND_NAME}</h1>
                      <p>ORDER RECEIPT</p>
                      <strong>{order.order_number}</strong>
                    </header>
                    <div className="admin-receipt-meta">
                      <span>Order date: {formatDateTime(order.created_at)}</span>
                      <span>Status: {ORDER_STATUS[order.status] ?? order.status}</span>
                      <span>Payment: {order.payment_method.replaceAll('_', ' ')}</span>
                    </div>
                    <section>
                      <h2>DELIVER TO</h2>
                      <p>{address.name || '—'}{address.phone ? ` · ${address.phone}` : ''}</p>
                      <p>{[address.line1, address.line2, address.landmark].filter(Boolean).join(', ') || '—'}</p>
                      <p>{[address.city, address.state, address.pincode].filter(Boolean).join(', ')}</p>
                    </section>
                    <table>
                      <thead>
                        <tr><th>ITEM</th><th>SKU</th><th>QTY</th><th>PRICE</th><th>AMOUNT</th></tr>
                      </thead>
                      <tbody>
                        {orderItems.map((item) => (
                          <tr key={item.id}>
                            <td>{item.title} · {item.size_label}{item.color_name ? ` · ${item.color_name}` : ''}</td>
                            <td>{item.sku}</td>
                            <td>{item.quantity}</td>
                            <td>{rupees(item.unit_price_paise / 100)}</td>
                            <td>{rupees(item.line_total_paise / 100)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="admin-receipt-totals">
                      <p><span>MRP</span><span>{rupees(order.total_mrp_paise / 100)}</span></p>
                      {order.product_discount_paise > 0 && <p><span>Product discount</span><span>−{rupees(order.product_discount_paise / 100)}</span></p>}
                      {order.coupon_discount_paise > 0 && <p><span>Coupon{order.coupon_code ? ` (${order.coupon_code})` : ''}</span><span>−{rupees(order.coupon_discount_paise / 100)}</span></p>}
                      {order.shipping_fee_paise > 0 && <p><span>Shipping</span><span>{rupees(order.shipping_fee_paise / 100)}</span></p>}
                      {order.cod_fee_paise > 0 && <p><span>COD fee</span><span>{rupees(order.cod_fee_paise / 100)}</span></p>}
                      {order.platform_fee_paise > 0 && <p><span>Platform fee</span><span>{rupees(order.platform_fee_paise / 100)}</span></p>}
                      {order.store_credit_used_paise > 0 && <p><span>Store credit</span><span>−{rupees(order.store_credit_used_paise / 100)}</span></p>}
                      <p><span>Tax included</span><span>{rupees(order.tax_paise / 100)}</span></p>
                      <p className="admin-receipt-grand-total"><strong>Total paid</strong><strong>{rupees(order.total_paise / 100)}</strong></p>
                    </div>
                    <footer>Thank you for shopping with {BRAND_NAME}. · {CONTACT_EMAIL}</footer>
                  </article>
                )}
              </details>
            )
          })}
        </div>
      )}
      {!loading && totalOrders > PAGE_SIZE && (
        <nav className="orders-admin-pagination" aria-label="Order pages">
          <button type="button" disabled={page === 0 || refreshing} onClick={() => setPage((current) => Math.max(0, current - 1))}>
            ← NEWER
          </button>
          <span>PAGE {page + 1} OF {Math.ceil(totalOrders / PAGE_SIZE)}</span>
          <button
            type="button"
            disabled={(page + 1) * PAGE_SIZE >= totalOrders || refreshing}
            onClick={() => setPage((current) => current + 1)}
          >
            OLDER →
          </button>
        </nav>
      )}
    </section>
  )
}

function NimbusPostFulfillment({
  orderId,
  packageDefault,
  presetLabel,
  items,
  onCreated,
}: {
  orderId: number
  packageDefault: OrderShippingPackage | null
  presetLabel: string
  items: AdminOrderItem[]
  onCreated: () => Promise<void>
}) {
  const quantity = packageDefault?.item_quantity ?? items.reduce((total, item) => total + item.quantity, 0)
  const itemIdsKey = items.map((item) => item.id).join(',')
  const itemIds = itemIdsKey ? itemIdsKey.split(',').map(Number) : []
  const [parcel, setParcel] = useState<ShippingPackage | null>(() => packageDefault ? {
    weightGrams: packageDefault.weight_grams,
    lengthCm: Number(packageDefault.length_cm),
    widthCm: Number(packageDefault.width_cm),
    heightCm: Number(packageDefault.height_cm),
  } : null)
  const [busy, setBusy] = useState(false)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [bookingResult, setBookingResult] = useState('')
  const [ratedParcel, setRatedParcel] = useState<ShippingPackage | null>(null)
  const [booked, setBooked] = useState(false)
  const [bookingLocked, setBookingLocked] = useState(false)
  const autoCheckStarted = useRef(false)

  const checkRates = useCallback(async () => {
    if (!packageDefault || !parcel || !validateShippingPackage(parcel)) {
      setError('Shipping package settings are unavailable or invalid.')
      return
    }
    setBusy(true)
    setError('')
    setResult('')
    setRatedParcel(null)
    const { data, error: invokeError } = await supabase.functions.invoke('nimbuspost-serviceability', {
      body: {
        orderId,
        itemIds: itemIdsKey.split(',').map(Number),
        parcel,
      },
    })
    setBusy(false)
    if (invokeError) {
      setError(invokeError.message)
      return
    }
    if (data?.error) {
      setError(String(data.error))
      return
    }
    setResult(JSON.stringify(data?.result ?? data, null, 2))
    setRatedParcel(parcel)
  }, [itemIdsKey, orderId, packageDefault, parcel])

  useEffect(() => {
    if (autoCheckStarted.current) return
    autoCheckStarted.current = true
    void checkRates()
  }, [checkRates])

  const createNimbusPostShipment = async () => {
    if (!ratedParcel || !parcel || JSON.stringify(ratedParcel) !== JSON.stringify(parcel) || !packageDefault) {
      setError('Recheck rates after changing package details before booking.')
      return
    }
    if (!window.confirm('This will create and book a real NimbusPost courier shipment and may charge your NimbusPost wallet. Continue?')) return

    setBookingLocked(true)
    setBooking(true)
    setError('')
    setBookingResult('')
    const { data, error: invokeError } = await supabase.functions.invoke('nimbuspost-create-shipment', {
      body: { orderId, itemIds, parcel: ratedParcel },
    })
    setBooking(false)
    if (invokeError) {
      setError(invokeError.message)
      return
    }
    if (data?.error) {
      setError(String(data.error))
      return
    }
    setBooked(true)
    setBookingResult(JSON.stringify(data?.booking ?? data, null, 2))
    await onCreated()
  }

  const updateParcel = (field: keyof ShippingPackage, value: string) => {
    setParcel((current) => current ? { ...current, [field]: value === '' ? Number.NaN : Number(value) } : current)
    setRatedParcel(null)
    setResult('')
  }
  const resetParcel = () => {
    if (!packageDefault) return
    setParcel({
      weightGrams: packageDefault.weight_grams,
      lengthCm: Number(packageDefault.length_cm),
      widthCm: Number(packageDefault.width_cm),
      heightCm: Number(packageDefault.height_cm),
    })
    setRatedParcel(null)
  }

  if (!packageDefault || !parcel) {
    return (
      <div className="orders-admin-shipment-form">
        <strong>NIMBUSPOST PACKAGE · WAREHOUSE {items[0]?.warehouse_id}</strong>
        <span className="orders-admin-error">Shipping presets are unavailable. Configure all three presets in Shipping Package Settings.</span>
      </div>
    )
  }

  return (
    <div className="orders-admin-shipment-form orders-admin-rate-check">
      <strong>NIMBUSPOST · {presetLabel.toUpperCase()} · {quantity} T-SHIRT{quantity === 1 ? '' : 'S'} · WAREHOUSE {items[0]?.warehouse_id}</strong>
      <span>Rates are checked automatically with the selected preset. Edit only for exceptional parcels. Booking requires confirmation and may charge your NimbusPost wallet.</span>
      <div>
        <label>WEIGHT (G)<input aria-label={`Parcel weight for order ${orderId}`} type="number" min="1" max="50000" step="1" value={Number.isFinite(parcel.weightGrams) ? parcel.weightGrams : ''} onChange={(event) => updateParcel('weightGrams', event.target.value)} /></label>
        <label>LENGTH (CM)<input aria-label={`Parcel length for order ${orderId}`} type="number" min="0.5" max="200" step="0.1" value={Number.isFinite(parcel.lengthCm) ? parcel.lengthCm : ''} onChange={(event) => updateParcel('lengthCm', event.target.value)} /></label>
        <label>WIDTH (CM)<input aria-label={`Parcel width for order ${orderId}`} type="number" min="0.5" max="200" step="0.1" value={Number.isFinite(parcel.widthCm) ? parcel.widthCm : ''} onChange={(event) => updateParcel('widthCm', event.target.value)} /></label>
        <label>HEIGHT (CM)<input aria-label={`Parcel height for order ${orderId}`} type="number" min="0.5" max="200" step="0.1" value={Number.isFinite(parcel.heightCm) ? parcel.heightCm : ''} onChange={(event) => updateParcel('heightCm', event.target.value)} /></label>
        <button type="button" disabled={busy || !validateShippingPackage(parcel)} onClick={() => void checkRates()}>
          {busy ? 'CHECKING…' : 'RECHECK RATES'}
        </button>
        <button type="button" disabled={busy || booking || bookingLocked || booked || !ratedParcel || JSON.stringify(ratedParcel) !== JSON.stringify(parcel)} onClick={() => void createNimbusPostShipment()}>
          {booking ? 'BOOKING…' : booked ? 'SHIPMENT BOOKED' : bookingLocked ? 'BOOKING REQUEST SENT' : 'BOOK NIMBUSPOST COURIER'}
        </button>
        <button type="button" disabled={busy || booking} onClick={resetParcel}>RESET TO PRESET</button>
      </div>
      {error && <span className="orders-admin-error" role="alert">{error}</span>}
      {result && <pre className="orders-admin-rate-result" role="status">{result}</pre>}
      {bookingResult && <pre className="orders-admin-rate-result" role="status">{bookingResult}</pre>}
    </div>
  )
}

function ShipmentEditor({
  shipment,
  onSave,
  onAdvance,
}: {
  shipment: AdminShipment
  onSave: (courier: string, awb: string, trackingUrl: string) => Promise<string>
  onAdvance: (status: ShipmentStatus) => Promise<void>
}) {
  const [courier, setCourier] = useState(shipment.courier ?? '')
  const [awb, setAwb] = useState(shipment.awb_number ?? '')
  const [trackingUrl, setTrackingUrl] = useState(shipment.tracking_url ?? '')
  const [nextStatus, setNextStatus] = useState<ShipmentStatus>(NEXT_SHIPMENT_STATUSES[shipment.status]?.[0] ?? 'delivered')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const nextStatuses = NEXT_SHIPMENT_STATUSES[shipment.status] ?? []

  const save = async () => {
    setBusy(true)
    setMessage(await onSave(courier, awb, trackingUrl))
    setBusy(false)
  }

  const advance = async () => {
    setBusy(true)
    setMessage('')
    await onAdvance(nextStatus)
    setBusy(false)
  }

  return (
    <div className="orders-admin-shipment-form">
      <strong>SHIPMENT #{shipment.id} · {shipment.status.replaceAll('_', ' ').toUpperCase()}</strong>
      {shipment.package_weight_grams !== null && (
        <span>
          Package: {shipment.package_weight_grams} g · {shipment.package_length_cm} × {shipment.package_width_cm} × {shipment.package_height_cm} cm
          {shipment.package_overridden ? ' · order override' : shipment.package_preset_key ? ` · ${shipment.package_preset_key.replaceAll('_', ' ')}` : ''}
          {shipment.nimbuspost_order_id ? ` · NimbusPost ${shipment.nimbuspost_order_id}` : ''}
        </span>
      )}
      <div>
        <input aria-label={`Courier for shipment ${shipment.id}`} value={courier} onChange={(event) => setCourier(event.target.value)} placeholder="Courier" />
        <input aria-label={`Tracking number for shipment ${shipment.id}`} value={awb} onChange={(event) => setAwb(event.target.value)} placeholder="Tracking / AWB number" />
        <input aria-label={`Tracking URL for shipment ${shipment.id}`} value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} placeholder="Tracking URL (optional)" />
        <button type="button" disabled={busy} onClick={() => void save()}>SAVE TRACKING</button>
      </div>
      {nextStatuses.length > 0 && (
        <div>
          <label>
            NEXT STATUS
            <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as ShipmentStatus)}>
              {nextStatuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ').toUpperCase()}</option>)}
            </select>
          </label>
          <button type="button" disabled={busy} onClick={() => void advance()}>UPDATE STATUS</button>
        </div>
      )}
      {message && <span className="orders-admin-error" role="alert">{message}</span>}
    </div>
  )
}
