import { useCart } from '../../context/cart/useCart'
import { rupees } from '../../utils/format'
import { Drawer } from '../common/Drawer'
import './CartDrawer.css'

export function CartDrawer() {
  const cart = useCart()

  return (
    <Drawer open={cart.isOpen} title="YOUR BAG" onClose={cart.close}>
      <div>
        {cart.items.length === 0 ? (
          <p className="small-note">Your bag is empty.</p>
        ) : (
          cart.items.map((item) => (
            <div className="drawer-item" key={item.name}>
              <div>
                <b>{item.name}</b>
                <p className="small-note">{rupees(item.price)} each</p>
                <button type="button" aria-label="Decrease quantity" onClick={() => cart.decrement(item.name)}>
                  −
                </button>{' '}
                <span>{item.qty}</span>{' '}
                <button type="button" aria-label="Increase quantity" onClick={() => cart.increment(item.name)}>
                  +
                </button>{' '}
                <button type="button" className="cart-remove" onClick={() => cart.remove(item.name)}>
                  REMOVE
                </button>
              </div>
              <b>{rupees(item.qty * item.price)}</b>
            </div>
          ))
        )}
      </div>
      <div className="drawer-total">
        <span>SUBTOTAL</span>
        <strong>{rupees(cart.subtotal)}</strong>
      </div>
      <button className="outline" onClick={() => alert('Demo only: connect a payment gateway before taking orders.')}>
        PROCEED TO CHECKOUT →
      </button>
      <p className="small-note">Checkout is not connected to a payment provider yet.</p>
    </Drawer>
  )
}
