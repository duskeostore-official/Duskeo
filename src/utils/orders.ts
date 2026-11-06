import type { OrderSummary } from '../context/account/accountContext'

export const ORDER_STATUS: Record<OrderSummary['status'], string> = {
  pending_payment: 'Awaiting payment',
  placed: 'Placed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

/** order_items.status (item_status_t) */
export const ITEM_STATUS: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  placed: 'Placed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  return_requested: 'Return requested',
  returned: 'Returned',
  exchanged: 'Exchanged',
  rto: 'Returned to us',
}

/** Help & support opens only once an item has reached the customer. */
const DELIVERED = ['delivered', 'return_requested', 'returned', 'exchanged']
export const isDelivered = (status: string, deliveredAt?: string | null) => DELIVERED.includes(status) || !!deliveredAt

/** Still on its way: tracking is offered instead of support. */
const ON_THE_WAY = ['pending_payment', 'placed', 'packed', 'shipped', 'out_for_delivery']
export const isOnTheWay = (status: string) => ON_THE_WAY.includes(status)

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
