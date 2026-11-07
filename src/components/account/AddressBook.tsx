import { useEffect, useState, type FormEvent } from 'react'
import { ROUTES } from '../../constants/routes'
import { useAccount } from '../../context/account/useAccount'
import type { Address, AddressType, NewAddress } from '../../context/account/accountContext'
import { supabase } from '../../lib/supabase'

const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
]

const EMPTY_ADDRESS: NewAddress = {
  name: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  address_type: 'home',
}

interface AddressBookProps {
  /** Show only the default + newest addresses up to this many, with a "view all" link for the rest. */
  limit?: number
  /** Called when the "view all" link is used (e.g. to close the panel it sits in). */
  onNavigate?: () => void
}

/** Saved addresses with add / edit / make default / delete. Default first, then newest. */
export function AddressBook({ limit, onNavigate }: AddressBookProps) {
  const account = useAccount()
  /** 'new' = adding an address; a number = editing that address; null = no form open. */
  const [editing, setEditing] = useState<'new' | number | null>(null)
  const [draft, setDraft] = useState<NewAddress>(EMPTY_ADDRESS)
  const [makeDefault, setMakeDefault] = useState(true)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [pinLookup, setPinLookup] = useState('')

  const field = (key: keyof NewAddress) => (value: string) => setDraft((d) => ({ ...d, [key]: value }))

  useEffect(() => {
    if (!/^[1-9][0-9]{5}$/.test(draft.pincode)) {
      setPinLookup('')
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setPinLookup('Looking up place and state…')
      try {
        const { data: savedPin } = await supabase
          .from('serviceable_pincodes')
          .select('city, state')
          .eq('pincode', draft.pincode)
          .maybeSingle()

        if (savedPin?.state && savedPin?.city) {
          setDraft((current) => ({
            ...current,
            city: savedPin.city,
            state: INDIAN_STATES.includes(savedPin.state) ? savedPin.state : current.state,
          }))
          setPinLookup(`${savedPin.city}, ${savedPin.state}`)
          return
        }

        const response = await fetch(`https://api.postalpincode.in/pincode/${draft.pincode}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Lookup failed')
        const results = (await response.json()) as Array<{
          Status?: string
          PostOffice?: Array<{ Name?: string; District?: string; State?: string }>
        }>
        const postOffice = results[0]?.Status === 'Success' ? results[0].PostOffice?.[0] : undefined
        if (!postOffice?.State) {
          setPinLookup('PIN code not found. Please enter city and state manually.')
          return
        }
        const place = postOffice.Name || postOffice.District || ''
        setDraft((current) => ({
          ...current,
          city: place || current.city,
          state: INDIAN_STATES.includes(postOffice.State) ? postOffice.State : current.state,
        }))
        setPinLookup(`${place ? `${place}, ` : ''}${postOffice.State}`)
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setPinLookup('Could not look up the PIN code. Please enter manually.')
        }
      }
    }, 400)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [draft.pincode])

  const saveAddress = async (event: FormEvent) => {
    event.preventDefault()
    if (!/^[6-9][0-9]{9}$/.test(draft.phone)) return setStatus('Enter a 10-digit mobile number (without +91).')
    if (!/^[1-9][0-9]{5}$/.test(draft.pincode)) return setStatus('Enter a valid 6-digit PIN code.')
    setBusy(true)
    const clean = { ...draft, line2: draft.line2?.trim() || null, landmark: draft.landmark?.trim() || null }
    const result =
      editing === 'new' || editing === null
        ? await account.addAddress(clean, makeDefault)
        : await account.updateAddress(editing, clean, makeDefault)
    setBusy(false)
    if (!result.ok) return setStatus(result.error ?? 'Could not save the address.')
    setStatus(editing === 'new' ? 'Address saved.' : 'Address updated.')
    closeForm()
  }

  const startAdding = () => {
    setDraft(EMPTY_ADDRESS)
    setMakeDefault(true)
    setEditing('new')
    setStatus('')
  }

  const startEditing = (address: Address) => {
    const { id, is_default, ...fields } = address
    setDraft({ ...fields, line2: fields.line2 ?? '', landmark: fields.landmark ?? '' })
    setMakeDefault(is_default)
    setEditing(id)
    setStatus('')
  }

  const closeForm = () => {
    setEditing(null)
    setDraft(EMPTY_ADDRESS)
  }

  const editingDefault = typeof editing === 'number' && !!account.addresses.find((a) => a.id === editing)?.is_default

  const run = async (action: Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true)
    const result = await action
    setBusy(false)
    setStatus(result.ok ? done : (result.error ?? 'Something went wrong.'))
  }

  const addressForm = (
    <form className="acct-card acct-form" onSubmit={saveAddress}>
      <strong className="acct-form-title">{editing === 'new' ? 'NEW ADDRESS' : 'EDIT ADDRESS'}</strong>
      <input
        required
        placeholder="Full name"
        autoComplete="name"
        value={draft.name}
        onChange={(e) => field('name')(e.target.value)}
      />
      <input
        required
        placeholder="Mobile number"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={10}
        value={draft.phone}
        onChange={(e) => field('phone')(e.target.value.replace(/\D/g, ''))}
      />
      <input
        required
        placeholder="House / flat / building"
        autoComplete="address-line1"
        value={draft.line1}
        onChange={(e) => field('line1')(e.target.value)}
      />
      <input
        placeholder="Street / area (optional)"
        autoComplete="address-line2"
        value={draft.line2 ?? ''}
        onChange={(e) => field('line2')(e.target.value)}
      />
      <input placeholder="Landmark (optional)" value={draft.landmark ?? ''} onChange={(e) => field('landmark')(e.target.value)} />
      <div className="acct-form-row">
        <input
          required
          placeholder="City / district"
          autoComplete="address-level2"
          value={draft.city}
          onChange={(e) => field('city')(e.target.value)}
        />
        <input
          required
          placeholder="PIN code"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          value={draft.pincode}
          onChange={(e) => field('pincode')(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      {pinLookup && (
        <span className="acct-label" role="status">
          {pinLookup}
        </span>
      )}
      <select required value={draft.state} onChange={(e) => field('state')(e.target.value)}>
        <option value="" disabled>
          State
        </option>
        {INDIAN_STATES.map((state) => (
          <option key={state} value={state}>
            {state}
          </option>
        ))}
      </select>
      <div className="acct-chips" role="radiogroup" aria-label="Address type">
        {(['home', 'work', 'other'] as AddressType[]).map((type) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={draft.address_type === type}
            className={draft.address_type === type ? 'active' : ''}
            onClick={() => setDraft((d) => ({ ...d, address_type: type }))}
          >
            {type.toUpperCase()}
          </button>
        ))}
      </div>
      <label className="acct-check">
        <input
          type="checkbox"
          checked={makeDefault}
          disabled={editingDefault}
          onChange={(e) => setMakeDefault(e.target.checked)}
        />
        {editingDefault ? 'This is your default address' : 'Make this my default address'}
      </label>
      <div className="acct-form-actions">
        <button type="submit" className="outline" disabled={busy}>
          {busy ? 'SAVING…' : editing === 'new' ? 'SAVE ADDRESS' : 'SAVE CHANGES'}
        </button>
        <button type="button" className="acct-text-btn" onClick={closeForm}>
          CANCEL
        </button>
      </div>
    </form>
  )

  const visible = limit ? account.addresses.slice(0, limit) : account.addresses
  const hidden = account.addresses.length - visible.length

  return (
    <>
    {account.addresses.length === 0 && editing !== 'new' && <p className="acct-empty">No saved addresses yet.</p>}
    <ul className="acct-list">
      {visible.map((address) =>
        editing === address.id ? (
          <li key={address.id}>{addressForm}</li>
        ) : (
          <li key={address.id} className={`acct-card acct-address${address.is_default ? ' is-default' : ''}`}>
            <div className="acct-address-top">
              <strong>{address.name}</strong>
              <span className="acct-badge">
                {address.is_default ? 'DEFAULT' : address.address_type.toUpperCase()}
              </span>
            </div>
            <p>
              {[address.line1, address.line2, address.landmark].filter(Boolean).join(', ')}
              <br />
              {address.city}, {address.state} – {address.pincode}
              <br />
              {address.phone}
            </p>
            {address.is_default && (
              <span className="acct-label">PIN {address.pincode} is used to check size availability.</span>
            )}
            <div className="acct-address-actions">
              <button type="button" disabled={busy} onClick={() => startEditing(address)}>
                EDIT
              </button>
              {!address.is_default && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(account.setDefaultAddress(address.id), 'Default address updated.')}
                >
                  MAKE DEFAULT
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  window.confirm('Delete this address?') &&
                  void run(account.deleteAddress(address.id), 'Address deleted.')
                }
              >
                DELETE
              </button>
            </div>
          </li>
        ),
      )}
    </ul>

    {hidden > 0 && (
      <a className="acct-view-all" href={ROUTES.addresses} onClick={onNavigate}>
        VIEW ALL ADDRESSES ({account.addresses.length}) →
      </a>
    )}

    {editing === 'new' ? (
      addressForm
    ) : (
      <button type="button" className="outline acct-add" onClick={startAdding}>
        + ADD NEW ADDRESS
      </button>
    )}
    <p className="acct-status" aria-live="polite">
      {status}
    </p>
    </>
  )
}
