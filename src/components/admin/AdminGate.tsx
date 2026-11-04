import { useEffect, useState } from 'react'
import { AdminLogin } from './AdminLogin'
import { InventoryAdmin } from './InventoryAdmin'
import { supabase } from '../../lib/supabase'
import './Admin.css'

/**
 * Private route: open the site with #admin. No public link is shown.
 * Mount only while the route is active so each visit starts at the login step.
 */
export function AdminGate({ onClose }: { onClose: () => void }) {
  const [signedIn, setSignedIn] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setSignedIn(false)
        setChecking(false)
        return
      }
      const { data: isAdmin, error } = await supabase.rpc('is_admin')
      setSignedIn(!error && isAdmin === true)
      setChecking(false)
    }
    void checkSession()
  }, [])

  if (checking) return null
  return signedIn ? <InventoryAdmin onClose={onClose} /> : <AdminLogin onSuccess={() => setSignedIn(true)} onCancel={onClose} />
}
