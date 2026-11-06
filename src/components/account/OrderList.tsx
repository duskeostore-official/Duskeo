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
  const visible = limit ? account.orders.slice(0, limit) : account.orders

  if (account.orders.length === 0) {
    return <p className="acct-empty">{account.loading ? 'Loading…' : 'No orders yet.'}</p>
  }

  return (
    <>
      <ul className="acct-list">
        {visible.map((order) => (
          <li key={order.id}>
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
          </li>
        ))}
      </ul>
      {limit && (
        <a className="acct-view-all" href={ROUTES.orders} onClick={onNavigate}>
          VIEW ALL ORDERS{account.orders.length > limit ? ` (${account.orders.length})` : ''} →
        </a>
      )}
    </>
  )
}
