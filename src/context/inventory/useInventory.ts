import { useContext } from 'react'
import { InventoryContext } from './inventoryContext'

export function useInventory() {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory must be used inside <InventoryProvider>')
  return ctx
}
