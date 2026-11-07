import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { AccountContext, type Address, type NewAddress, type OrderSummary } from './accountContext'
import { isValidPhone } from '../../utils/phone'

const ADDRESS_COLUMNS = 'id, name, phone, line1, line2, landmark, city, state, pincode, address_type, is_default'
const ORDER_COLUMNS = 'id, order_number, status, total_paise, item_count, created_at'

/** Signed-in customer's profile, saved addresses and orders (all limited to their own rows by RLS). */
export function AccountProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState<'' | 'male' | 'female' | 'other'>('')
  const [dateOfBirth, setDateOfBirth] = useState('')
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
    let lastError: { message: string } | null = null

    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await supabase
        .from('addresses')
        .select(ADDRESS_COLUMNS)
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false }) // default first, then newest

      if (!error) {
        if (currentUserId.current === userId) {
          setAddresses((data as Address[] | null) ?? [])
        }
        return { ok: true as const }
      }

      lastError = error
      if (attempt === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 300))
      }
    }

    // A temporary network/RLS query failure must not erase data already in memory.
    return { ok: false as const, error: lastError?.message || 'Could not load saved addresses.' }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      const clear = window.setTimeout(() => {
        setName('')
        setEmail('')
        setPhone('')
        setGender('')
        setDateOfBirth('')
        setAddresses([])
        setOrders([])
      }, 0)
      return () => window.clearTimeout(clear)
    }
    let cancelled = false
    const load = window.setTimeout(async () => {
      setLoading(true)
      const [profile, , orderRows] = await Promise.all([
        supabase.from('profiles').select('full_name, email, phone, gender, date_of_birth').eq('id', userId).maybeSingle(),
        loadAddresses(),
        supabase.from('orders').select(ORDER_COLUMNS).order('created_at', { ascending: false }).limit(100),
      ])
      if (cancelled) return
      setName(profile.data?.full_name ?? '')
      setEmail(profile.data?.email ?? authEmail)
      setPhone(profile.data?.phone ?? '')
      setGender(profile.data?.gender ?? '')
      setDateOfBirth(profile.data?.date_of_birth ?? '')
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
      if (!isValidPhone(address.phone)) return { ok: false, error: 'Enter a valid mobile number.' }
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
      if (!isValidPhone(address.phone)) return { ok: false, error: 'Enter a valid mobile number.' }
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

  const updateProfile = useCallback(
    async (profile: {
      fullName: string
      phone: string
      gender: '' | 'male' | 'female' | 'other'
      dateOfBirth: string
    }) => {
      if (!userId) return { ok: false, error: 'Please sign in first.' }
      const fullName = profile.fullName.trim()
      if (!fullName) return { ok: false, error: 'Enter your name.' }
      if (profile.phone && !isValidPhone(profile.phone)) {
        return { ok: false, error: 'Enter a valid mobile number, including the country code when needed.' }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: profile.phone || null,
          gender: profile.gender || null,
          date_of_birth: profile.dateOfBirth || null,
        })
        .eq('id', userId)
      if (error) return { ok: false, error: error.message }

      await supabase.auth.updateUser({ data: { full_name: fullName } })
      setName(fullName)
      setPhone(profile.phone)
      setGender(profile.gender)
      setDateOfBirth(profile.dateOfBirth)
      return { ok: true }
    },
    [userId],
  )

  const value = useMemo(
    () => ({
      userId,
      ready,
      name,
      email,
      phone,
      gender,
      dateOfBirth,
      addresses,
      defaultAddress: addresses.find((a) => a.is_default) ?? null,
      orders,
      loading,
      updateProfile,
      addAddress,
      updateAddress,
      setDefaultAddress,
      deleteAddress,
    }),
    [userId, ready, name, email, phone, gender, dateOfBirth, addresses, orders, loading, updateProfile, addAddress, updateAddress, setDefaultAddress, deleteAddress],
  )

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}
