import { useState } from 'react'
import { AdminLogin } from './AdminLogin'
import { InventoryAdmin } from './InventoryAdmin'
import './Admin.css'

/**
 * Private route: open the site with #admin. No public link is shown.
 * Mount only while the route is active so each visit starts at the login step.
 */
export function AdminGate({ onClose }: { onClose: () => void }) {
  const [signedIn, setSignedIn] = useState(false)
  return signedIn ? <InventoryAdmin onClose={onClose} /> : <AdminLogin onSuccess={() => setSignedIn(true)} onCancel={onClose} />
}
