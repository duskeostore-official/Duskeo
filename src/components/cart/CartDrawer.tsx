import { useState } from 'react'
import { SIZES } from '../../constants/site'
import { useAccount } from '../../context/account/useAccount'
import { useCart } from '../../context/cart/useCart'
import { useCatalog } from '../../context/catalog/useCatalog'
import { useInventory } from '../../context/inventory/useInventory'
import type { CartItem, Size } from '../../types'
import { loadRazorpay } from '../../lib/razorpay'
import { supabase } from '../../lib/supabase'
import { rupees } from '../../utils/format'
import { Drawer } from '../common/Drawer'
import './CartDrawer.css'

interface CartDrawerProps {
  onOpenProfile: () => void
}

interface CreateRazorpayOrderResponse {
  requiresPayment: boolean
  orderId: number
  orderNumber: string
  amountPaise?: number
  currency?: 'INR'
  razorpayOrderId?: string
  keyId?: string
}

interface VerifyRazorpayPaymentResponse {
  ok: boolean
  orderNumber: string
  result: string
  paymentStatus: string
  error?: string
}

export function CartDrawer({ onOpenProfile }: CartDrawerProps) {
  const cart = useCart()
  const catalog = useCatalog()
  const inventory = useInventory()
  const account = useAccount()
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutPending, setCheckoutPending] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutMessage, setCheckoutMessage] = useState('')

  const photoOf = (product: string) => catalog.products.find((p) => p.name === product)?.photos[0]?.src
  const selectedAddress = account.addresses.find((address) => address.id === selectedAddressId)
    ?? account.defaultAddress
    ?? account.addresses[0]
    ?? null

  const openAccount = () => {
    cart.close()
    onOpenProfile()
  }

  const cancelAndRestore = async (orderId: number, items: CartItem[], reason: string) => {
    const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId, p_reason: reason })
    if (error) {
      setCheckoutError('Payment was not completed, but the pending order could not be cancelled. Check My Orders before trying again.')
    } else {
      await cart.restore(items)
      setCheckoutError('')
      setCheckoutMessage('Payment cancelled. Your bag has been restored.')
    }
    setCheckoutBusy(false)
  }

  const beginCheckout = async () => {
    if (!account.userId) {
      openAccount()
      return
    }
    if (!selectedAddress) {
      openAccount()
      return
    }
    if (!cart.items.length || checkoutBusy || checkoutPending) return

    const cartSnapshot = cart.items.map((item) => ({ ...item }))
    let internalOrderId: number | null = null
    setCheckoutBusy(true)
    setCheckoutError('')
    setCheckoutMessage('')

    try {
      const loaded = await loadRazorpay()
      const Razorpay = window.Razorpay
      if (!loaded || !Razorpay) throw new Error('Razorpay Checkout could not be loaded. Please try again.')

      const { data, error } = await supabase.functions.invoke<CreateRazorpayOrderResponse>('razorpay-create-order', {
        body: { addressId: selectedAddress.id },
      })
      if (error) throw new Error(error.message)
      if (!data) throw new Error('Could not start checkout. Please try again.')

      internalOrderId = data.orderId
      if (!data.requiresPayment) {
        await cart.restore([])
        setCheckoutMessage(`Order ${data.orderNumber} was placed.`)
        setCheckoutBusy(false)
        return
      }
      if (!data.razorpayOrderId || !data.keyId || !data.amountPaise || !data.orderId) {
        throw new Error('Razorpay returned an incomplete checkout order.')
      }

      let paymentResolved = false
      const checkout = new Razorpay({
        key: data.keyId,
        amount: data.amountPaise,
        currency: data.currency ?? 'INR',
        name: 'DUSKEO',
        description: `Order ${data.orderNumber}`,
        order_id: data.razorpayOrderId,
        prefill: {
          name: account.name || selectedAddress.name,
          email: account.email,
          contact: selectedAddress.phone,
        },
        handler: async (payment) => {
          paymentResolved = true
          setCheckoutError('')
          setCheckoutMessage('Verifying your payment…')
          const { data: verification, error: verifyError } = await supabase.functions.invoke<VerifyRazorpayPaymentResponse>(
            'razorpay-verify-payment',
            {
              body: {
                orderId: data.orderId,
                razorpayOrderId: payment.razorpay_order_id,
                razorpayPaymentId: payment.razorpay_payment_id,
                razorpaySignature: payment.razorpay_signature,
              },
            },
          )

          if (verifyError || !verification?.ok) {
            setCheckoutMessage('If your bank approved the payment, it may still be processing. Check My Orders before trying again.')
            setCheckoutError(verifyError?.message || verification?.error || 'Could not verify the payment yet.')
            setCheckoutBusy(false)
            return
          }

          if (verification.result === 'placed' || verification.result === 'already_placed') {
            await cart.restore([])
            setCheckoutMessage(`Payment confirmed. Order ${verification.orderNumber} is placed.`)
          } else if (verification.result === 'amount_mismatch_refunded' || verification.result === 'late_payment_refunded') {
            setCheckoutError('The payment could not be applied to this order. An automatic refund has been started.')
          } else {
            setCheckoutPending(true)
            setCheckoutMessage('Payment received and awaiting confirmation. Check My Orders before trying again.')
          }
          setCheckoutBusy(false)
        },
        modal: {
          ondismiss: () => {
            if (!paymentResolved) {
              void cancelAndRestore(data.orderId, cartSnapshot, 'Payment cancelled by customer')
            }
          },
        },
      })

      checkout.on('payment.failed', (failure) => {
        setCheckoutError(failure.error?.description || 'Payment failed. You can retry or close checkout.')
      })
      checkout.open()
    } catch (error) {
      if (internalOrderId !== null) {
        const { error: cancelError } = await supabase.rpc('cancel_order', {
          p_order_id: internalOrderId,
          p_reason: 'Razorpay checkout could not be opened',
        })
        if (cancelError) {
          setCheckoutError('Checkout could not start and the pending order could not be cancelled. Check My Orders before trying again.')
          setCheckoutBusy(false)
          return
        }
      }
      await cart.restore(cartSnapshot)
      setCheckoutError(error instanceof Error ? error.message : 'Could not start checkout. Please try again.')
      setCheckoutBusy(false)
    }
  }

  return (
    <Drawer open={cart.isOpen} title="YOUR BAG" onClose={cart.close} size="large">
      <div className="cart-items">
        {cart.items.length === 0 ? (
          <p className="cart-empty">Your bag is empty.</p>
        ) : (
          cart.items.map((item) => {
            const photo = photoOf(item.product)
            return (
              <div className="cart-line" key={item.name}>
                {photo ? <img className="cart-line-photo" src={photo} alt="" /> : <span className="cart-line-photo" />}
                <div className="cart-line-info">
                  <b className="cart-line-name">{item.product}</b>
                  <span className="cart-line-price">{rupees(item.price)} each</span>
                  <div className="cart-line-controls">
                    <label className="cart-size">
                      <span>SIZE</span>
                      <select
                        value={item.size}
                        aria-label={`Size for ${item.product}`}
                        onChange={(e) => cart.changeSize(item.name, e.target.value as Size)}
                      >
                        {SIZES.map((size) => {
                          const available = size === item.size || inventory.quantity(item.product, size) > 0
                          return (
                            <option key={size} value={size} disabled={!available}>
                              {available ? size : `${size} — sold out`}
                            </option>
                          )
                        })}
                      </select>
                    </label>
                    <div className="cart-qty">
                      <button type="button" aria-label="Decrease quantity" onClick={() => cart.decrement(item.name)}>
                        −
                      </button>
                      <span aria-label="Quantity">{item.qty}</span>
                      <button type="button" aria-label="Increase quantity" onClick={() => cart.increment(item.name)}>
                        +
                      </button>
                    </div>
                    <button type="button" className="cart-remove" onClick={() => cart.remove(item.name)}>
                      REMOVE
                    </button>
                  </div>
                </div>
                <b className="cart-line-total">{rupees(item.qty * item.price)}</b>
              </div>
            )
          })
        )}
      </div>
      <div className="cart-foot">
        <div className="drawer-total">
          <span>SUBTOTAL</span>
          <strong>{rupees(cart.subtotal)}</strong>
        </div>
        {account.userId && account.addresses.length > 0 ? (
          <label className="cart-checkout-address">
            <span>DELIVER TO</span>
            <select
              value={selectedAddress?.id ?? ''}
              aria-label="Delivery address"
              onChange={(event) => setSelectedAddressId(Number(event.target.value))}
            >
              {account.addresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.name} — {address.city}, {address.pincode}{address.is_default ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="small-note">
            {account.ready
              ? account.userId ? 'Add a delivery address before checkout.' : 'Sign in and add a delivery address to checkout.'
              : 'Checking your account…'}
          </p>
        )}
        {selectedAddress && account.userId && (
          <p className="cart-checkout-address-summary">
            {selectedAddress.line1}, {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}
          </p>
        )}
        <button
          className="outline"
          type="button"
          disabled={!account.ready || account.loading || !cart.items.length || checkoutBusy || checkoutPending}
          onClick={() => {
            if (!account.userId || !selectedAddress) {
              openAccount()
              return
            }
            void beginCheckout()
          }}
        >
          {checkoutBusy
            ? 'OPENING SECURE CHECKOUT…'
            : checkoutPending
              ? 'PAYMENT PROCESSING…'
              : !account.userId
                ? 'SIGN IN TO CHECKOUT'
                : !selectedAddress
                  ? 'ADD DELIVERY ADDRESS'
                  : 'PROCEED TO PAYMENT →'}
        </button>
        <p className="small-note">Delivery charges and the final total are verified securely at checkout.</p>
        {checkoutError && <p className="cart-checkout-error" role="alert">{checkoutError}</p>}
        {checkoutMessage && <p className="cart-checkout-message" role="status">{checkoutMessage}</p>}
      </div>
    </Drawer>
  )
}
