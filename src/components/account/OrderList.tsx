import { useState } from 'react'
import { orderHref, ROUTES } from '../../constants/routes'
import { useAccount } from '../../context/account/useAccount'
import { formatDate, ORDER_STATUS } from '../../utils/orders'
import { rupees } from '../../utils/format'

interface OrderListProps {
  /** Show only the newest orders up to this many, with a "view all" link. */
  limit?: number
  /** Called when a link is used (e.g. to close the panel it sits in). */
  onNavigate?: () => void
}

/** Customer's orders, newest first; each one opens its detail page. */
export function OrderList({ limit, onNavigate }: OrderListProps) {
  const account = useAccount()
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [cancelError, setCancelError] = useState('')
  const activeOrders = account.orders.filter((order) => order.status !== 'cancelled')
  const visible = limit ? activeOrders.slice(0, limit) : activeOrders

  const cancelOrder = async (id: number, orderNumber: string) => {
    if (!window.confirm(`Cancel unpaid order ${orderNumber}?`)) return
    setCancellingId(id)
    setCancelError('')
    try {
      const result = await account.cancelOrder(id)
      if (!result.ok) setCancelError(`Could not cancel ${orderNumber}: ${result.error}`)
    } catch (error) {
      setCancelError(`Could not cancel ${orderNumber}: ${error instanceof Error ? error.message : 'Please try again.'}`)
    } finally {
      setCancellingId(null)
    }
  }

  if (activeOrders.length === 0) {
    return <p className="acct-empty">{account.loading ? 'Loading…' : 'No active orders.'}</p>
  }

  return (
    <>
      <ul className="acct-list">
        {visible.map((order) => (
          <li key={order.id}>
            <div className="acct-order-entry">
              <a className="acct-card acct-order" href={orderHref(order.id)} onClick={onNavigate}>
                <div>
                  <strong>{order.order_number}</strong>
                  <span className="acct-label">
                    {formatDate(order.created_at)} · {order.item_count} item{order.item_count === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="acct-order-side">
                  <strong>{rupees(order.total_paise / 100)}</strong>
                  <span className={`acct-badge is-${order.status}`}>{ORDER_STATUS[order.status]}</span>
                </div>
              </a>
              {order.status === 'pending_payment' && (
                <button
                  type="button"
                  className="acct-order-cancel"
                  disabled={cancellingId !== null}
                  onClick={() => void cancelOrder(order.id, order.order_number)}
                >
                  {cancellingId === order.id ? 'CANCELLING…' : 'CANCEL UNPAID ORDER'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {cancelError && <p className="acct-order-cancel-error" role="alert">{cancelError}</p>}
      {limit && (
        <a className="acct-view-all" href={ROUTES.orders} onClick={onNavigate}>
          VIEW ALL ORDERS{activeOrders.length > limit ? ` (${activeOrders.length})` : ''} →
        </a>
      )}
    </>
  )
}
