import { useState, type FormEvent } from 'react'
import { SIZES } from '../../constants/site'
import { ROUTES } from '../../constants/routes'
import { useAccount } from '../../context/account/useAccount'
import { useCart } from '../../context/cart/useCart'
import { useCatalog } from '../../context/catalog/useCatalog'
import { useInventory } from '../../context/inventory/useInventory'
import type { CartItem, Size } from '../../types'
import { supabase } from '../../lib/supabase'
import { rupees } from '../../utils/format'
import { Drawer } from '../common/Drawer'
import './CartDrawer.css'

interface PayUCheckout {
  actionUrl: string
  fields: Record<string, string>
}

interface CreatedOrder {
  order_id: number
}

const CHECKOUT_ITEMS_KEY = 'duskeo-payu-checkout-items'

export function CartDrawer({ onOpenProfile }: { onOpenProfile: () => void }) {
  const cart = useCart()
  const account = useAccount()
  const catalog = useCatalog()
  const inventory = useInventory()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [addressId, setAddressId] = useState('')
  const [checkoutStatus, setCheckoutStatus] = useState('')
  const [checkoutBusy, setCheckoutBusy] = useState(false)

  const photoOf = (product: string) => catalog.products.find((p) => p.name === product)?.photos[0]?.src
  const selectedAddressId = addressId || String(account.defaultAddress?.id ?? account.addresses[0]?.id ?? '')
  const closeCart = () => {
    cart.close()
    setCheckoutOpen(false)
    setCheckoutStatus('')
  }

  const startCheckout = async (event: FormEvent) => {
    event.preventDefault()
    if (!account.userId) {
      setCheckoutStatus('Sign in to place your order.')
      return
    }
    if (!cart.items.length) {
      setCheckoutStatus('Your bag is empty.')
      return
    }
    if (!selectedAddressId) {
      setCheckoutStatus('Add a delivery address before checkout.')
      return
    }

    setCheckoutBusy(true)
    setCheckoutStatus('')
    const savedItems: CartItem[] = cart.items.map((item) => ({ ...item }))
    let orderId: number | null = null
    let recoverOrder = false

    try {
      const { data, error } = await supabase.rpc('place_order', {
        p_address_id: Number(selectedAddressId),
        p_payment_method: 'upi',
        p_coupon_code: null,
        p_use_store_credit: false,
      })
      if (error) throw new Error(error.message)
      const order = (data as CreatedOrder[] | null)?.[0]
      if (!order?.order_id) throw new Error('The order could not be created. Please try again.')
      orderId = order.order_id
      recoverOrder = true

      try {
        sessionStorage.setItem(CHECKOUT_ITEMS_KEY, JSON.stringify(savedItems))
      } catch {
        throw new Error('Your browser could not save the bag for payment recovery. Please allow session storage and try again.')
      }

      const { data: checkout, error: paymentError } = await supabase.functions.invoke<PayUCheckout>(
        'payu-hosted-checkout',
        { body: { orderId } },
      )
      if (paymentError) throw new Error(paymentError.message)
      if (!checkout?.actionUrl || !checkout.fields) throw new Error('PayU returned an invalid checkout response. Please try again.')

      const form = document.createElement('form')
      form.method = 'POST'
      form.action = checkout.actionUrl
      Object.entries(checkout.fields).forEach(([name, value]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = name
        input.value = value
        form.append(input)
      })
      document.body.append(form)
      closeCart()
      form.submit()
      recoverOrder = false
    } catch (error) {
      if (orderId && recoverOrder) {
        const { error: cancelError } = await supabase.rpc('cancel_order', { p_order_id: orderId })
        if (!cancelError) {
          await cart.restore(savedItems)
          try {
            sessionStorage.removeItem(CHECKOUT_ITEMS_KEY)
          } catch {
            setCheckoutStatus('The pending order was cancelled, but your browser could not clear the saved checkout data.')
          }
        }
        if (cancelError) {
          setCheckoutStatus(`${error instanceof Error ? error.message : 'Checkout failed.'} The pending order could not be cancelled: ${cancelError.message}`)
        } else {
          setCheckoutStatus(error instanceof Error ? error.message : 'Checkout failed. Please try again.')
        }
      } else {
        setCheckoutStatus(error instanceof Error ? error.message : 'Checkout failed. Please try again.')
      }
      setCheckoutBusy(false)
    }
  }

  return (
    <Drawer open={cart.isOpen} title="YOUR BAG" onClose={closeCart} size="large">
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
        {checkoutOpen ? (
          <form className="cart-checkout" onSubmit={startCheckout}>
            {account.userId ? (
              account.addresses.length ? (
                <label className="cart-checkout-address">
                  <span>DELIVER TO</span>
                  <select value={selectedAddressId} onChange={(event) => setAddressId(event.target.value)} required>
                    {account.addresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.name} — {address.line1}, {address.city} ({address.pincode}){address.is_default ? ' · Default' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="small-note">
                  Add a saved address before checkout.{' '}
                  <a
                    href={ROUTES.addresses}
                    onClick={() => {
                      closeCart()
                      window.location.hash = ROUTES.addresses
                    }}
                  >
                    ADD ADDRESS
                  </a>
                </p>
              )
            ) : (
              <button
                type="button"
                className="outline"
                onClick={() => {
                  closeCart()
                  onOpenProfile()
                }}
              >
                SIGN IN TO CHECKOUT
              </button>
            )}
            <p className="small-note">You’ll complete payment securely on PayU.</p>
            {checkoutStatus && <p className="small-note cart-checkout-status" role="status">{checkoutStatus}</p>}
            <div className="cart-checkout-actions">
              <button type="button" className="outline" onClick={() => setCheckoutOpen(false)} disabled={checkoutBusy}>
                BACK TO BAG
              </button>
              {account.userId && account.addresses.length > 0 && (
                <button className="outline" type="submit" disabled={checkoutBusy || !cart.items.length}>
                  {checkoutBusy ? 'CONNECTING TO PAYU…' : 'CONTINUE TO PAYU'}
                </button>
              )}
            </div>
          </form>
        ) : (
          <>
            <p className="small-note">Secure checkout with PayU. Sign in and choose a delivery address to continue.</p>
            {cart.items.length > 0 && (
              <button className="outline cart-checkout-button" type="button" onClick={() => setCheckoutOpen(true)}>
                CHECKOUT
              </button>
            )}
          </>
        )}
      </div>
    </Drawer>
  )
}
