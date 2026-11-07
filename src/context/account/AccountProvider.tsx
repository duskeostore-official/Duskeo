import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { AccountContext, type Address, type NewAddress, type OrderSummary } from './accountContext'

const ADDRESS_COLUMNS = 'id, name, phone, line1, line2, landmark, city, state, pincode, address_type, is_default'
const ORDER_COLUMNS = 'id, order_number, status, total_paise, item_count, created_at'

/** Signed-in customer's profile, saved addresses and orders (all limited to their own rows by RLS). */
export function AccountProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [addresses, setAddresses] = useState<Address[]>([])
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(false)
  const currentUserId = useRef<string | null>(null)

  useEffect(() => {
    // supabase-js: don't call Supabase inside this callback; the effect below does the work.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user.id ?? null
      currentUserId.current = nextUserId
      setAddresses([])
      setOrders([])
      setUserId(nextUserId)
      setAuthEmail(session?.user.email ?? '')
      setReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const loadAddresses = useCallback(async () => {
    if (!userId) {
      setAddresses([])
      return
    }
    const { data } = await supabase
      .from('addresses')
      .select(ADDRESS_COLUMNS)
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false }) // default first, then newest
    if (currentUserId.current === userId) {
      setAddresses((data as Address[] | null) ?? [])
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      const clear = window.setTimeout(() => {
        setName('')
        setEmail('')
        setAddresses([])
        setOrders([])
      }, 0)
      return () => window.clearTimeout(clear)
    }
    let cancelled = false
    const load = window.setTimeout(async () => {
      setLoading(true)
      const [profile, , orderRows] = await Promise.all([
        supabase.from('profiles').select('full_name, email').eq('id', userId).maybeSingle(),
        loadAddresses(),
        supabase.from('orders').select(ORDER_COLUMNS).order('created_at', { ascending: false }).limit(100),
      ])
      if (cancelled) return
      setName(profile.data?.full_name ?? '')
      setEmail(profile.data?.email ?? authEmail)
      setOrders((orderRows.data as OrderSummary[] | null) ?? [])
      setLoading(false)
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(load)
    }
  }, [authEmail, loadAddresses, userId])

  // Only one default per user (unique index), so the old default is cleared first.
  const clearDefault = useCallback(async () => {
    if (!userId) return null
    const { error } = await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId).eq('is_default', true)
    return error
  }, [userId])

  const addAddress = useCallback(
    async (address: NewAddress, makeDefault: boolean) => {
      if (!userId) return { ok: false, error: 'Please sign in first.' }
      const isDefault = makeDefault || addresses.length === 0
      if (isDefault) {
        const error = await clearDefault()
        if (error) return { ok: false, error: error.message }
      }
      const { error } = await supabase.from('addresses').insert({ ...address, user_id: userId, is_default: isDefault })
      await loadAddresses()
      return error ? { ok: false, error: error.message } : { ok: true }
    },
    [addresses.length, clearDefault, loadAddresses, userId],
  )

  const updateAddress = useCallback(
    async (id: number, address: NewAddress, makeDefault: boolean) => {
      if (!userId) return { ok: false, error: 'Please sign in first.' }
      const wasDefault = addresses.find((a) => a.id === id)?.is_default ?? false
      if (makeDefault && !wasDefault) {
        const error = await clearDefault()
        if (error) return { ok: false, error: error.message }
      }
      const { error } = await supabase
        .from('addresses')
        .update({ ...address, is_default: makeDefault || wasDefault })
        .eq('id', id)
        .eq('user_id', userId)
      await loadAddresses()
      return error ? { ok: false, error: error.message } : { ok: true }
    },
    [addresses, clearDefault, loadAddresses, userId],
  )

  const setDefaultAddress = useCallback(
    async (id: number) => {
      if (!userId) return { ok: false, error: 'Please sign in first.' }
      const cleared = await clearDefault()
      const { error } = cleared ? { error: cleared } : await supabase.from('addresses').update({ is_default: true }).eq('id', id).eq('user_id', userId)
      await loadAddresses()
      return error ? { ok: false, error: error.message } : { ok: true }
    },
    [clearDefault, loadAddresses, userId],
  )

  const deleteAddress = useCallback(
    async (id: number) => {
      if (!userId) return { ok: false, error: 'Please sign in first.' }
      const { error } = await supabase.from('addresses').delete().eq('id', id).eq('user_id', userId)
      await loadAddresses()
      return error ? { ok: false, error: error.message } : { ok: true }
    },
    [loadAddresses, userId],
  )

  const value = useMemo(
    () => ({
      userId,
      ready,
      name,
      email,
      addresses,
      defaultAddress: addresses.find((a) => a.is_default) ?? null,
      orders,
      loading,
      addAddress,
      updateAddress,
      setDefaultAddress,
      deleteAddress,
    }),
    [userId, ready, name, email, addresses, orders, loading, addAddress, updateAddress, setDefaultAddress, deleteAddress],
  )

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}
