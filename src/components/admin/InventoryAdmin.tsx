import { useState } from 'react'
import { SIZES } from '../../constants/site'
import { useInventory } from '../../context/inventory/useInventory'
import { PRODUCTS } from '../../data/products'
import type { Size, Stock } from '../../types'
import { zeroStock } from '../../utils/inventory'

export function InventoryAdmin({ onClose }: { onClose: () => void }) {
  const inventory = useInventory()
  // Inputs edit a draft; nothing changes on the site until SAVE.
  const [draft, setDraft] = useState<Stock>(inventory.stock)
  const [status, setStatus] = useState('')

  const setQty = (product: string, size: Size, value: string) =>
    setDraft((d) => ({ ...d, [product]: { ...d[product], [size]: Math.max(0, Math.floor(Number(value) || 0)) } }))

  const save = () => {
    inventory.replace(draft)
    setStatus('Stock saved in this browser. Product availability has been refreshed.')
  }

  const reset = () => {
    inventory.reset()
    setDraft(zeroStock())
    setStatus('All stock quantities reset to zero.')
  }

  return (
    <div
      className="inventory-admin open"
      role="dialog"
      aria-modal="true"
      aria-label="Inventory management"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="inventory-admin-panel">
        <div className="inventory-admin-head">
          <h2>DUSKEO / INVENTORY CONTROL</h2>
          <button type="button" aria-label="Close inventory admin" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="admin-warning">
          Set the real available quantity for every product and size. Stock is saved only in this browser on this
          device. This demo panel has no login protection and is not a secure production admin system. Initial
          quantities are set to zero so the site does not claim stock you have not entered.
        </p>
        <table className="inventory-table">
          <thead>
            <tr>
              <th>PRODUCT</th>
              {SIZES.map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRODUCTS.map(({ name }) => (
              <tr key={name}>
                <td>{name}</td>
                {SIZES.map((s) => (
                  <td key={s}>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      aria-label={`${name} ${s} stock`}
                      value={draft[name][s]}
                      onChange={(e) => setQty(name, s, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="admin-actions">
          <button type="button" onClick={save}>
            SAVE STOCK
          </button>
          <button type="button" onClick={reset}>
            RESET TO ZERO
          </button>
        </div>
        <p className="admin-status" aria-live="polite">
          {status}
        </p>
      </div>
    </div>
  )
}
