import { SIZES } from '../../constants/site'
import { useCart } from '../../context/cart/useCart'
import { useCatalog } from '../../context/catalog/useCatalog'
import { useInventory } from '../../context/inventory/useInventory'
import type { Size } from '../../types'
import { rupees } from '../../utils/format'
import { Drawer } from '../common/Drawer'
import './CartDrawer.css'

export function CartDrawer() {
  const cart = useCart()
  const catalog = useCatalog()
  const inventory = useInventory()

  const photoOf = (product: string) => catalog.products.find((p) => p.name === product)?.photos[0]?.src

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
        <p className="small-note" role="status">
          Checkout is temporarily unavailable while we update payment options. Your items remain in your bag.
        </p>
      </div>
    </Drawer>
  )
}
