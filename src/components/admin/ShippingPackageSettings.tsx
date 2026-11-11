import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { ShippingPackagePreset } from '../../utils/shippingPackages'

type PresetDraft = Pick<ShippingPackagePreset, 'weight_grams' | 'length_cm' | 'width_cm' | 'height_cm'>

export function ShippingPackageSettings() {
  const [presets, setPresets] = useState<ShippingPackagePreset[]>([])
  const [drafts, setDrafts] = useState<Record<string, PresetDraft>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadPresets = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('shipping_package_presets')
      .select('preset_key, label, min_quantity, max_quantity, weight_grams, length_cm, width_cm, height_cm')
      .order('min_quantity')
    if (loadError) {
      throw new Error(loadError.message)
    }

    return (data ?? []) as ShippingPackagePreset[]
  }, [])

  useEffect(() => {
    let active = true
    void loadPresets()
      .then((loaded) => {
        if (!active) return
        setPresets(loaded)
        setDrafts(Object.fromEntries(loaded.map((preset) => [preset.preset_key, {
          weight_grams: preset.weight_grams,
          length_cm: preset.length_cm,
          width_cm: preset.width_cm,
          height_cm: preset.height_cm,
        }])))
      })
      .catch((loadError: Error) => {
        if (active) setError(`Could not load shipping package settings: ${loadError.message}`)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadPresets])

  const updateDraft = (key: string, field: keyof PresetDraft, value: string) => {
    setDrafts((current) => ({
      ...current,
      [key]: { ...current[key], [field]: value === '' ? 0 : Number(value) },
    }))
  }

  const savePreset = async (preset: ShippingPackagePreset) => {
    const draft = drafts[preset.preset_key]
    if (!draft || !Number.isInteger(draft.weight_grams) || draft.weight_grams < 1 || draft.weight_grams > 50000
      || ![draft.length_cm, draft.width_cm, draft.height_cm].every((value) => Number.isFinite(value) && value >= 0.5 && value <= 200)) {
      setError('Enter a whole-number weight from 1 to 50000 g and dimensions from 0.5 to 200 cm.')
      return
    }

    setSavingKey(preset.preset_key)
    setMessage('')
    setError('')
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      setError(userError?.message ?? 'Your admin session has expired. Sign in again.')
      setSavingKey(null)
      return
    }

    const { error: saveError } = await supabase
      .from('shipping_package_presets')
      .update({ ...draft, updated_at: new Date().toISOString(), updated_by: userData.user.id })
      .eq('preset_key', preset.preset_key)
    if (saveError) {
      setError(`Could not save ${preset.label}: ${saveError.message}`)
      setSavingKey(null)
      return
    }

    setMessage(`${preset.label} package preset saved.`)
    setSavingKey(null)
    try {
      const loaded = await loadPresets()
      setPresets(loaded)
      setDrafts(Object.fromEntries(loaded.map((savedPreset) => [savedPreset.preset_key, {
        weight_grams: savedPreset.weight_grams,
        length_cm: savedPreset.length_cm,
        width_cm: savedPreset.width_cm,
        height_cm: savedPreset.height_cm,
      }])))
    } catch (loadError) {
      const detail = loadError instanceof Error ? loadError.message : String(loadError)
      setError(`Preset was saved, but refreshing settings failed: ${detail}`)
    }
  }

  return (
    <section className="shipping-package-settings" aria-labelledby="shipping-package-settings-heading">
      <header>
        <h3 id="shipping-package-settings-heading">SHIPPING PACKAGE SETTINGS</h3>
        <p>Estimated package values selected by the total T-shirt quantity in a parcel. These values also feed NimbusPost rate checks and shipment bookings.</p>
      </header>
      {error && <p className="orders-admin-error" role="alert">{error}</p>}
      {message && <p className="orders-admin-message" role="status">{message}</p>}
      {loading ? <p className="orders-admin-message" role="status">Loading package presets…</p> : presets.length !== 3 ? (
        <p className="orders-admin-error" role="alert">Expected all three package presets. Apply the latest Supabase migration, then refresh this section.</p>
      ) : (
        <div className="shipping-package-presets">
          {presets.map((preset) => {
            const draft = drafts[preset.preset_key]
            return (
              <fieldset key={preset.preset_key}>
                <legend>{preset.label}</legend>
                <p>{preset.max_quantity === null ? `${preset.min_quantity}+ T-shirts` : `${preset.min_quantity} T-shirt${preset.min_quantity === 1 ? '' : 's'}`}</p>
                <label>
                  WEIGHT (G)
                  <input aria-label={`${preset.label} weight in grams`} type="number" min="1" max="50000" step="1" value={draft?.weight_grams ?? ''} onChange={(event) => updateDraft(preset.preset_key, 'weight_grams', event.target.value)} />
                </label>
                <label>
                  LENGTH (CM)
                  <input aria-label={`${preset.label} length in centimeters`} type="number" min="0.5" max="200" step="0.1" value={draft?.length_cm ?? ''} onChange={(event) => updateDraft(preset.preset_key, 'length_cm', event.target.value)} />
                </label>
                <label>
                  WIDTH (CM)
                  <input aria-label={`${preset.label} width in centimeters`} type="number" min="0.5" max="200" step="0.1" value={draft?.width_cm ?? ''} onChange={(event) => updateDraft(preset.preset_key, 'width_cm', event.target.value)} />
                </label>
                <label>
                  HEIGHT (CM)
                  <input aria-label={`${preset.label} height in centimeters`} type="number" min="0.5" max="200" step="0.1" value={draft?.height_cm ?? ''} onChange={(event) => updateDraft(preset.preset_key, 'height_cm', event.target.value)} />
                </label>
                <button type="button" disabled={savingKey !== null} onClick={() => void savePreset(preset)}>
                  {savingKey === preset.preset_key ? 'SAVING…' : 'SAVE PRESET'}
                </button>
              </fieldset>
            )
          })}
        </div>
      )}
    </section>
  )
}
