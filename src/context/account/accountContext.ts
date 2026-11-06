import { createContext } from 'react'

export type AddressType = 'home' | 'work' | 'other'

/** A row of public.addresses. */
export interface Address {
  id: number
  name: string
  phone: string
  line1: string
  line2: string | null
  landmark: string | null
  city: string
  state: string
  pincode: string
  address_type: AddressType
  is_default: boolean
}

export type NewAddress = Omit<Address, 'id' | 'is_default'>

/** A row of public.orders (summary columns only). */
export interface OrderSummary {
  id: number
  order_number: string
  status: 'pending_payment' | 'placed' | 'completed' | 'cancelled'
  total_paise: number
  item_count: number
  created_at: string
}

export interface AccountContextValue {
  /** null when signed out */
  userId: string | null
  /** false until the saved login has been checked (avoids a "please sign in" flash on reload) */
  ready: boolean
  name: string
  email: string
  addresses: Address[]
  /** The address whose PIN code the size picker uses. */
  defaultAddress: Address | null
  orders: OrderSummary[]
  loading: boolean
  addAddress: (address: NewAddress, makeDefault: boolean) => Promise<{ ok: boolean; error?: string }>
  updateAddress: (id: number, address: NewAddress, makeDefault: boolean) => Promise<{ ok: boolean; error?: string }>
  setDefaultAddress: (id: number) => Promise<{ ok: boolean; error?: string }>
  deleteAddress: (id: number) => Promise<{ ok: boolean; error?: string }>
}

export const AccountContext = createContext<AccountContextValue | null>(null)
