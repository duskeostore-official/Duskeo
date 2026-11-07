import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ADDED_FEEDBACK_MS } from '../../constants/site'
import { STORAGE_KEYS } from '../../constants/storage'
import { useAccount } from '../../context/account/useAccount'
import { useCart } from '../../context/cart/useCart'
import { useInventory } from '../../context/inventory/useInventory'
import { useProductModal } from '../../context/productModal/useProductModal'
import { supabase } from '../../lib/supabase'
import { SizeSelector } from '../../pages/product/components/SizeSelector'
import type { Product, Size } from '../../types'
import { rupees } from '../../utils/format'
import { readString, writeString } from '../../utils/storage'
import { BottomSheet } from '../common/BottomSheet'
import './QuickAddSheet.css'

const PIN_PATTERN = /^[1-9][0-9]{5}$/

/** Result of the check_delivery() database function. */
interface Delivery {
  valid: boolean
  deliverable: boolean
  cod_available?: boolean
  delivery_days?: number | null
  city?: string | null
  sizes: { size: Size; available: number }[]
}

interface QuickAddSheetProps {
  product: Product
  open: boolean
  onClose: () => void
}

/** Card "ADD TO BAG": PIN code first, then only the sizes that are in stock and deliverable there. */
export function QuickAddSheet({ product, open, onClose }: QuickAddSheetProps) {
  const cart = useCart()
  const inventory = useInventory()
  const modal = useProductModal()
  // Signed in with a default address: its PIN is used; otherwise the last PIN checked here.
  const defaultPin = useAccount().defaultAddress?.pincode
  const [pincode, setPincode] = useState(() => defaultPin ?? readString(STORAGE_KEYS.pincode) ?? '')
  const pincodeRef = useRef(pincode)
  const [delivery, setDelivery] = useState<Delivery | null>(null)
  const [checking, setChecking] = useState(false)
  const [size, setSize] = useState<Size | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const check = useCallback(
    async (pin: string) => {
      if (!PIN_PATTERN.test(pin)) {
        setDelivery(null)
        setStatus('Enter a valid 6-digit PIN code.')
        return
      }
      setChecking(true)
      setStatus('')
      const { data, error } = await supabase.rpc('check_delivery', { p_slug: product.slug, p_pincode: pin })
      setChecking(false)
      if (error || !data) {
        setStatus('Could not check delivery. Please try again.')
        return
      }
      writeString(STORAGE_KEYS.pincode, pin)
      const result = data as Delivery
      setDelivery(result)
      setSize((current) => (current && result.sizes.some((s) => s.size === current) ? current : null))
    },
    [product.slug],
  )

  // Re-check every time the picker opens (stock may have changed), starting from the default address PIN.
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      if (defaultPin) {
        pincodeRef.current = defaultPin
        setPincode(defaultPin)
      }
      if (PIN_PATTERN.test(pincodeRef.current)) void check(pincodeRef.current)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [open, check, defaultPin])

  const changePincode = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6)
    pincodeRef.current = digits
    setPincode(digits)
    setStatus('')
    if (digits.length === 6) void check(digits)
    else setDelivery(null)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void check(pincode)
  }

  const isAvailable = (s: Size) => !!delivery?.deliverable && delivery.sizes.some((item) => item.size === s)
  const selectedAvailability = delivery?.sizes.find((item) => item.size === size)?.available

  const addToBag = async () => {
    if (!size || !isAvailable(size)) return
    if (!cart.canAdd(product.name, size)) {
      setStatus(`You already have 10 of size ${size} in your bag.`)
      return
    }
    setBusy(true)
    const taken = await inventory.take(product.name, size)
    setBusy(false)
    if (!taken) {
      setStatus(`Sorry, size ${size} just sold out.`)
      void check(pincode)
      return
    }
    cart.add(product.name, size, product.price)
    setStatus(`ADDED ✓ — ${product.name}, size ${size}`)
    window.setTimeout(onClose, ADDED_FEEDBACK_MS)
  }

  const viewDetails = () => {
    onClose()
    modal.open(product.slug)
  }

  const deliveryNote = () => {
    if (checking) return 'Checking delivery…'
    if (!delivery) return 'Enter your PIN code to see the sizes we can deliver to you.'
    if (!delivery.deliverable) return `Sorry, we don't deliver to ${pincode} yet.`
    const place = delivery.city ? ` (${delivery.city})` : ''
    const days = delivery.delivery_days ? ` in about ${delivery.delivery_days} days` : ''
    const cod = delivery.cod_available ? ' · Cash on delivery available' : ''
    const source = defaultPin === pincode ? ' (your default address)' : ''
    return `Delivers to ${pincode}${source}${place}${days}${cod}`
  }

  const canAdd = !!size && isAvailable(size) && !busy

  return (
    <BottomSheet
      className="quick-add"
      open={open}
      title="ADD TO BAG"
      onClose={onClose}
      footer={
        <div className="quick-add-actions">
          <button type="button" className="add quick-add-submit" disabled={!canAdd} onClick={() => void addToBag()}>
            {busy ? 'ADDING…' : size ? `ADD SIZE ${size} TO BAG +` : 'SELECT A SIZE'}
          </button>
          <button type="button" className="quick-add-details" onClick={viewDetails}>
            VIEW FULL DETAILS →
          </button>
        </div>
      }
    >
      <div className="quick-add-product">
        <img src={product.photos[0]?.src} alt={product.cardAlt} />
        <div>
          <strong>{product.name}</strong>
          <span>{rupees(product.price)}</span>
        </div>
      </div>

      <form className="quick-add-pincode" onSubmit={submit}>
        <label htmlFor={`quick-add-pin-${product.slug}`}>DELIVERY PIN CODE</label>
        <div>
          <input
            id={`quick-add-pin-${product.slug}`}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="e.g. 560001"
            maxLength={6}
            value={pincode}
            onChange={(e) => changePincode(e.target.value)}
          />
          <button type="submit" disabled={checking}>
            {checking ? '…' : 'CHECK'}
          </button>
        </div>
        <p className={`quick-add-delivery${delivery && !delivery.deliverable ? ' is-blocked' : ''}`} aria-live="polite">
          {deliveryNote()}
        </p>
      </form>

      {delivery?.deliverable && (
        <>
          <SizeSelector selected={size} isAvailable={isAvailable} onSelect={(s) => isAvailable(s) && setSize(s)} />
          {selectedAvailability !== undefined && selectedAvailability > 0 && selectedAvailability < 5 && (
            <p className="quick-add-stock-status" aria-live="polite">
              ONLY {selectedAvailability} LEFT IN SIZE {size}
            </p>
          )}
          {delivery.sizes.length === 0 && (
            <p className="small-note">All sizes are sold out right now. Open the full details to request a restock.</p>
          )}
        </>
      )}

      <p className="quick-add-status" aria-live="polite">
        {status}
      </p>
    </BottomSheet>
  )
}
