import { useEffect, useRef, useState } from 'react'
import type { CartItem } from '../../types'
import { useAccount } from '../../context/account/useAccount'
import { useCart } from '../../context/cart/useCart'
import { ROUTES, orderHref } from '../../constants/routes'
import { supabase } from '../../lib/supabase'
import { rupees } from '../../utils/format'
import './CheckoutResultPage.css'

const CHECKOUT_ITEMS_KEY = 'duskeo-payu-checkout-items'

interface CheckoutOrder {
  id: number
  order_number: string
  status: 'pending_payment' | 'placed' | 'completed' | 'cancelled'
  total_paise: number
}

export function CheckoutResultPage({
  orderId,
  state,
  onOpenProfile,
}: {
  orderId: number
  state: 'success' | 'failed' | 'pending' | 'refunded'
  onOpenProfile: () => void
}) {
  const account = useAccount()
  const cart = useCart()
  const [order, setOrder] = useState<CheckoutOrder | null>(null)
  const [loadError, setLoadError] = useState('')
  const [checking, setChecking] = useState(true)
  const recoveryStarted = useRef(false)

  useEffect(() => {
    if (!account.ready || !account.userId) return

    let active = true
    let attempts = 0
    let timer: number | undefined
    const loadOrder = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, total_paise')
        .eq('id', orderId)
        .maybeSingle()
      if (!active) return
      if (error) {
        setLoadError('We could not load your order. Please check your orders page.')
        setChecking(false)
        return
      }
      if (!data) {
        setLoadError('We could not find this order in your account.')
        setChecking(false)
        return
      }

      const nextOrder = data as CheckoutOrder
      setOrder(nextOrder)
      if (nextOrder.status !== 'pending_payment' || attempts >= 8) {
        setChecking(false)
        return
      }
      attempts += 1
      timer = window.setTimeout(loadOrder, 1500)
    }

    void loadOrder()
    return () => {
      active = false
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [account.ready, account.userId, orderId])

  useEffect(() => {
    if (!account.ready || !account.userId || !order || recoveryStarted.current) return
    const confirmed = order.status === 'placed' || order.status === 'completed'
    if (!confirmed && state !== 'failed' && state !== 'refunded') return

    recoveryStarted.current = true
    try {
      if (confirmed) {
        sessionStorage.removeItem(CHECKOUT_ITEMS_KEY)
        void cart.restore([])
      } else {
        const saved = sessionStorage.getItem(CHECKOUT_ITEMS_KEY)
        if (saved) {
          const items = JSON.parse(saved) as CartItem[]
          if (Array.isArray(items)) void cart.restore(items)
        }
        sessionStorage.removeItem(CHECKOUT_ITEMS_KEY)
      }
    } catch {
      queueMicrotask(() => {
        setLoadError('Your order result loaded, but the bag could not be restored automatically. Please contact support if needed.')
      })
    }
  }, [account.ready, account.userId, cart, order, state])

  const confirmed = order?.status === 'placed' || order?.status === 'completed'
  const failed = state === 'failed' && order?.status === 'pending_payment'
  const cancelled = order?.status === 'cancelled'
  const waitingForOrder = !account.ready || (!!account.userId && checking)

  return (
    <main className="checkout-result-page">
      <section className="checkout-result-card" aria-live="polite">
        <p className="page-kicker">DUSKEO / ORDER UPDATE</p>
        {confirmed ? (
          <>
            <h1>THANK YOU FOR YOUR ORDER</h1>
            <p className="checkout-result-message">
              Your order is confirmed. We’re getting it ready for you.
            </p>
            <p className="checkout-result-order">
              ORDER <strong>{order.order_number}</strong>
            </p>
            <p className="checkout-result-total">Total: {rupees(order.total_paise / 100)}</p>
          </>
        ) : failed ? (
          <>
            <h1>PAYMENT NOT COMPLETED</h1>
            <p className="checkout-result-message">
              The payment wasn’t completed, so your order is not confirmed. You can return to your bag and try again.
            </p>
            <p className="checkout-result-order">
              ORDER <strong>{order?.order_number}</strong>
            </p>
          </>
        ) : state === 'refunded' ? (
          <>
            <h1>PAYMENT REFUND INITIATED</h1>
            <p className="checkout-result-message">
              We couldn’t match the payment to this order total, or the payment arrived after the order expired. A refund has been initiated; please contact support if it does not appear.
            </p>
            {order && (
              <p className="checkout-result-order">
                ORDER <strong>{order.order_number}</strong>
              </p>
            )}
          </>
        ) : cancelled ? (
          <>
            <h1>ORDER CANCELLED</h1>
            <p className="checkout-result-message">
              This order was not confirmed. You can return to your bag and try again.
            </p>
            <p className="checkout-result-order">
              ORDER <strong>{order.order_number}</strong>
            </p>
          </>
        ) : (
          <>
            <h1>{waitingForOrder ? 'VERIFYING YOUR PAYMENT' : 'ORDER NOT CONFIRMED YET'}</h1>
            <p className="checkout-result-message">
              {waitingForOrder
                ? 'Please wait while we confirm your payment with PayU. Your order is confirmed only after verification.'
                : account.userId
                  ? 'We haven’t received payment confirmation yet. Please check your orders before trying again.'
                  : 'Sign in to view the payment status for this order.'}
            </p>
            {order && (
              <p className="checkout-result-order">
                ORDER <strong>{order.order_number}</strong>
              </p>
            )}
          </>
        )}
        {loadError && <p className="checkout-result-error" role="status">{loadError}</p>}
        {!account.ready ? null : account.userId ? (
          <a className="outline checkout-result-link" href={order ? orderHref(order.id) : ROUTES.orders}>
            VIEW MY ORDERS
          </a>
        ) : (
          <button type="button" className="outline checkout-result-link" onClick={onOpenProfile}>
            SIGN IN TO VIEW YOUR ORDER
          </button>
        )}
        <a className="checkout-result-home" href={ROUTES.home}>CONTINUE SHOPPING</a>
      </section>
    </main>
  )
}
