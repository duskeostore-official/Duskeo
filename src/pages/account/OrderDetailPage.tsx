import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ROUTES } from '../../constants/routes'
import { SUPPORT_EMAIL } from '../../constants/site'
import { useAccount } from '../../context/account/useAccount'
import type { OrderSummary } from '../../context/account/accountContext'
import { useCatalog } from '../../context/catalog/useCatalog'
import { productHref } from '../../data/products'
import { supabase } from '../../lib/supabase'
import { rupees } from '../../utils/format'
import { formatDate, formatDateTime, isDelivered, isOnTheWay, ITEM_STATUS, ORDER_STATUS } from '../../utils/orders'
import '../../components/account/AccountSections.css'
import { AccountPage } from './AccountPage'

interface OrderRow {
  id: number
  order_number: string
  status: OrderSummary['status']
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
  total_paise: number
  tax_paise: number
  placed_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  created_at: string
}

interface ItemRow {
  id: number
  shipment_id: number | null
  sku: string
  title: string
  size_label: string
  color_name: string
  image_key: string | null
  quantity: number
  unit_mrp_paise: number
  unit_price_paise: number
  line_total_paise: number
  status: string
  delivered_at: string | null
  return_window_ends_at: string | null
  products: { slug: string } | null
}

interface HistoryRow {
  id: number
  order_item_id: number | null
  to_status: string
  note: string | null
  created_at: string
}

interface ShipmentRow {
  id: number
  courier: string | null
  awb_number: string | null
  tracking_url: string | null
  status: string
}

const PAYMENT: Record<string, string> = {
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Net banking',
  wallet: 'Wallet',
  cod: 'Cash on delivery',
  store_credit: 'Store credit',
}

const ISSUES = [
  'Size / fit issue',
  'Damaged or defective item',
  'Wrong item received',
  'Print or quality issue',
  'Missing item in package',
  'Return or exchange',
  'Refund',
  'Something else',
]

const paise = (value: number) => rupees(value / 100)

/** One order: items, price details, address, timeline; tracking before delivery, help & support after. */
export function OrderDetailPage({ orderId, onOpenProfile }: { orderId: number; onOpenProfile: () => void }) {
  const account = useAccount()
  const catalog = useCatalog()
  const [order, setOrder] = useState<OrderRow | null>(null)
  const [items, setItems] = useState<ItemRow[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [shipments, setShipments] = useState<ShipmentRow[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [trackingNote, setTrackingNote] = useState<number | 'order' | null>(null)
  const [helpItem, setHelpItem] = useState<string>('')
  const [issue, setIssue] = useState(ISSUES[0])
  const [message, setMessage] = useState('')
  const [helpSent, setHelpSent] = useState(false)
  const helpRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!account.userId) return
    let cancelled = false
    const load = window.setTimeout(async () => {
      const [o, i, h, s] = await Promise.all([
        supabase.from('orders').select('*').eq('id', orderId).maybeSingle(),
        supabase.from('order_items').select('*, products(slug)').eq('order_id', orderId).order('id'),
        supabase.from('order_status_history').select('id, order_item_id, to_status, note, created_at').eq('order_id', orderId).order('created_at'),
        supabase.from('shipments').select('id, courier, awb_number, tracking_url, status').eq('order_id', orderId),
      ])
      if (cancelled) return
      if (!o.data) return setState('missing')
      setOrder(o.data as OrderRow)
      setItems((i.data as ItemRow[] | null) ?? [])
      setHistory((h.data as HistoryRow[] | null) ?? [])
      setShipments((s.data as ShipmentRow[] | null) ?? [])
      setState('ready')
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(load)
    }
  }, [account.userId, orderId])

  const photoOf = (item: ItemRow) =>
    item.image_key?.startsWith('http')
      ? item.image_key
      : (item.products && catalog.findProduct(item.products.slug)?.photos[0]?.src) || undefined

  const deliveredItems = items.filter((item) => isDelivered(item.status, item.delivered_at))
  const onTheWay = order?.status !== 'cancelled' && items.some((item) => isOnTheWay(item.status))
  const shipmentOf = (item: ItemRow) => shipments.find((s) => s.id === item.shipment_id)
  const trackingLink = (item?: ItemRow) =>
    (item ? shipmentOf(item)?.tracking_url : shipments.find((s) => s.tracking_url)?.tracking_url) ?? null

  const openHelp = (itemId: string) => {
    setHelpItem(itemId)
    setHelpSent(false)
    window.requestAnimationFrame(() => helpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const sendHelp = (event: FormEvent) => {
    event.preventDefault()
    if (!order) return
    const item = items.find((i) => String(i.id) === helpItem)
    const address = order.shipping_address
    const lines = [
      'Hello DUSKEO team,',
      '',
      message.trim() || '(no message)',
      '',
      `Issue: ${issue}`,
      `Order: ${order.order_number} (placed ${formatDate(order.placed_at ?? order.created_at)})`,
      ...(item
        ? [
            `Product: ${item.title}`,
            `Size: ${item.size_label} | Colour: ${item.color_name} | Qty: ${item.quantity}`,
            `SKU: ${item.sku}`,
            `Price paid: ${paise(item.line_total_paise)}`,
            ...(item.delivered_at ? [`Delivered: ${formatDate(item.delivered_at)}`] : []),
            ...(item.products ? [`Product page: ${window.location.origin}/${productHref(item.products.slug)}`] : []),
            ...(photoOf(item) ? [`Product image: ${new URL(photoOf(item)!, window.location.href).href}`] : []),
          ]
        : [`Items: ${items.map((i) => `${i.title} (${i.size_label}) x${i.quantity}`).join(', ')}`]),
      `Order total: ${paise(order.total_paise)}`,
      '',
      `Customer: ${account.name || address.name || ''} <${account.email}>`,
      ...(address.phone ? [`Phone: ${address.phone}`] : []),
      '',
      'Please attach photos of the item / package if relevant.',
    ]
    const subject = `Help with order ${order.order_number}${item ? ` — ${item.title} (${item.size_label})` : ''} — ${issue}`
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`
    setHelpSent(true)
  }

  const priceRows: [string, number, boolean?][] = order
    ? [
        ['Total MRP', order.total_mrp_paise],
        ['Discount on MRP', -order.product_discount_paise],
        [`Coupon${order.coupon_code ? ` (${order.coupon_code})` : ''}`, -order.coupon_discount_paise],
        ['Shipping', order.shipping_fee_paise],
        ['Cash on delivery fee', order.cod_fee_paise],
        ['Platform fee', order.platform_fee_paise],
        ['Store credit used', -order.store_credit_used_paise],
      ]
    : []

  const address = order?.shipping_address

  return (
    <AccountPage
      kicker="DUSKEO / YOUR ACCOUNT / ORDERS"
      title={order ? order.order_number : 'ORDER DETAILS'}
      backHref={ROUTES.orders}
      backLabel="ALL ORDERS"
      onOpenProfile={onOpenProfile}
    >
      {state === 'loading' && <p className="acct-empty">Loading your order…</p>}
      {state === 'missing' && (
        <p className="acct-empty">
          We couldn't find this order. <a href={ROUTES.orders}>See all your orders →</a>
        </p>
      )}
      {state === 'ready' && order && (
        <div className="order-detail">
          <div className="order-main">
            <section className="acct-card order-head">
              <div>
                <span className="acct-label">Placed on</span>
                <strong>{formatDate(order.placed_at ?? order.created_at)}</strong>
              </div>
              <div>
                <span className="acct-label">Status</span>
                <span className={`acct-badge is-${order.status}`}>{ORDER_STATUS[order.status]}</span>
              </div>
              <div>
                <span className="acct-label">Total</span>
                <strong>{paise(order.total_paise)}</strong>
              </div>
            </section>

            {/* Tracking before delivery; help & support only after. */}
            <div className="order-actions">
              {onTheWay &&
                (trackingLink() ? (
                  <a className="outline" href={trackingLink()!} target="_blank" rel="noreferrer">
                    TRACK ORDER ↗
                  </a>
                ) : (
                  <button type="button" className="outline" onClick={() => setTrackingNote('order')}>
                    TRACK ORDER
                  </button>
                ))}
              {deliveredItems.length > 0 && (
                <button type="button" className="outline" onClick={() => openHelp(String(deliveredItems[0].id))}>
                  HELP &amp; SUPPORT
                </button>
              )}
            </div>
            {trackingNote === 'order' && (
              <p className="order-note">
                Live tracking is coming soon. As soon as your order ships we'll show the courier and tracking number
                here.
              </p>
            )}
            {order.status === 'cancelled' && (
              <p className="order-note">
                This order was cancelled{order.cancelled_at ? ` on ${formatDate(order.cancelled_at)}` : ''}
                {order.cancel_reason ? ` — ${order.cancel_reason}` : ''}.
              </p>
            )}

            <section>
              <h2 className="order-heading">ITEMS ({order.item_count})</h2>
              <ul className="acct-list">
                {items.map((item) => {
                  const photo = photoOf(item)
                  const delivered = isDelivered(item.status, item.delivered_at)
                  const link = trackingLink(item)
                  return (
                    <li key={item.id} className="acct-card order-item">
                      {photo ? <img src={photo} alt="" /> : <span className="order-item-photo" />}
                      <div className="order-item-info">
                        {item.products ? (
                          <a href={productHref(item.products.slug)}>
                            <strong>{item.title}</strong>
                          </a>
                        ) : (
                          <strong>{item.title}</strong>
                        )}
                        <span className="acct-label">
                          Size {item.size_label} · {item.color_name} · Qty {item.quantity}
                        </span>
                        <span className="order-item-price">
                          {paise(item.line_total_paise)}
                          {item.unit_mrp_paise > item.unit_price_paise && (
                            <s className="acct-label">{paise(item.unit_mrp_paise * item.quantity)}</s>
                          )}
                        </span>
                        <span className={`acct-badge is-${item.status}`}>
                          {ITEM_STATUS[item.status] ?? item.status}
                          {item.delivered_at ? ` · ${formatDate(item.delivered_at)}` : ''}
                        </span>
                        <div className="acct-address-actions">
                          {delivered && (
                            <button type="button" onClick={() => openHelp(String(item.id))}>
                              GET HELP WITH THIS ITEM
                            </button>
                          )}
                          {!delivered &&
                            order.status !== 'cancelled' &&
                            isOnTheWay(item.status) &&
                            (link ? (
                              <a className="order-track-link" href={link} target="_blank" rel="noreferrer">
                                TRACK ↗
                              </a>
                            ) : (
                              <button type="button" onClick={() => setTrackingNote(item.id)}>
                                TRACK
                              </button>
                            ))}
                        </div>
                        {trackingNote === item.id && (
                          <span className="acct-label">Tracking will appear here once this item ships.</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>

            {deliveredItems.length > 0 && helpItem && (
              <form ref={helpRef} className="acct-card acct-form order-help" onSubmit={sendHelp}>
                <strong className="acct-form-title">HELP &amp; SUPPORT</strong>
                <p>
                  Tell us what went wrong. We'll open your email app with the order and product details filled in — just
                  add photos if you have them and send.
                </p>
                <label className="order-field">
                  <span className="acct-label">Which item?</span>
                  <select value={helpItem} onChange={(e) => setHelpItem(e.target.value)}>
                    {deliveredItems.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.title} — Size {item.size_label}
                      </option>
                    ))}
                    <option value="order">The whole order</option>
                  </select>
                </label>
                <label className="order-field">
                  <span className="acct-label">What's the issue?</span>
                  <select value={issue} onChange={(e) => setIssue(e.target.value)}>
                    {ISSUES.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label className="order-field">
                  <span className="acct-label">Describe the problem</span>
                  <textarea
                    rows={4}
                    maxLength={1200}
                    placeholder="e.g. The print on the back is peeling after the first wash."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>
                <div className="acct-form-actions">
                  <button type="submit" className="outline">
                    SEND EMAIL TO SUPPORT
                  </button>
                  <button type="button" className="acct-text-btn" onClick={() => setHelpItem('')}>
                    CANCEL
                  </button>
                </div>
                <span className="acct-label">
                  {helpSent ? 'Your email app should open now. ' : ''}
                  You can also write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with your order number.
                </span>
              </form>
            )}
          </div>

          <aside className="order-side">
            <section className="acct-card">
              <h2 className="order-heading">PRICE DETAILS</h2>
              <dl className="order-prices">
                {priceRows
                  .filter(([, value]) => value !== 0)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value < 0 ? `− ${paise(-value)}` : paise(value)}</dd>
                    </div>
                  ))}
                <div className="order-total">
                  <dt>Total</dt>
                  <dd>{paise(order.total_paise)}</dd>
                </div>
              </dl>
              {order.tax_paise > 0 && <span className="acct-label">Includes {paise(order.tax_paise)} GST</span>}
              <span className="acct-label">Paid by {PAYMENT[order.payment_method] ?? order.payment_method}</span>
            </section>

            {address && (
              <section className="acct-card">
                <h2 className="order-heading">DELIVERY ADDRESS</h2>
                <strong>{address.name}</strong>
                <p>
                  {[address.line1, address.line2, address.landmark].filter(Boolean).join(', ')}
                  <br />
                  {address.city}, {address.state} – {address.pincode}
                  <br />
                  {address.phone}
                </p>
              </section>
            )}

            {history.length > 0 && (
              <section className="acct-card">
                <h2 className="order-heading">TIMELINE</h2>
                <ol className="order-timeline">
                  {history.map((event) => {
                    const item = items.find((i) => i.id === event.order_item_id)
                    return (
                      <li key={event.id}>
                        <strong>
                          {ITEM_STATUS[event.to_status] ?? event.to_status}
                          {item ? ` — ${item.title} (${item.size_label})` : ''}
                        </strong>
                        <span className="acct-label">{formatDateTime(event.created_at)}</span>
                        {event.note && <span className="acct-label">{event.note}</span>}
                      </li>
                    )
                  })}
                </ol>
              </section>
            )}
          </aside>
        </div>
      )}
    </AccountPage>
  )
}
