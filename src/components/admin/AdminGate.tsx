import { useEffect, useState } from 'react'
import { AdminLogin } from './AdminLogin'
import { InventoryAdmin } from './InventoryAdmin'
import { supabase } from '../../lib/supabase'
import './Admin.css'

/**
 * Private route: mounted only on the dedicated /admin screen.
 * The Supabase is_admin RPC is the real authorization guard.
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
