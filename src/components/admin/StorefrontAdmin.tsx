import { useEffect, useState } from 'react'
import { loadStorefrontContent, saveStorefrontContent, uploadStorefrontImage, type StorefrontContent } from '../../lib/storefront'
import heroImage from '../../assets/images/home/hero-campaign.webp'

const KEYS = ['hero', 'campaign-1', 'campaign-2', 'campaign-3', 'campaign-4']
const DEFAULT_ITEMS: Record<string, StorefrontContent> = Object.fromEntries(
  KEYS.map((key, index) => [key, {
    key,
    title: key === 'hero' ? 'BEYOND ORDINARY.' : '',
    eyebrow: key === 'hero' ? 'THE NEXT CHAPTER' : '',
    body: '',
    image_url: key === 'hero' ? heroImage : '',
    link_url: '',
    active: key === 'hero',
    sort_order: index,
  }]),
)

export function StorefrontAdmin({ setStatus }: { setStatus: (status: string) => void }) {
  const [items, setItems] = useState<Record<string, StorefrontContent>>(DEFAULT_ITEMS)
  const [activeKey, setActiveKey] = useState('hero')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    void loadStorefrontContent().then(({ data, error }) => {
      if (error) {
        setStatus('Using current local preview. Database publishing is not connected yet.')
        return
      }
      const mapped = Object.fromEntries(data.map((item) => [item.key, item]))
      setItems((current) => Object.fromEntries(
        KEYS.map((key) => [key, { ...DEFAULT_ITEMS[key], ...mapped[key], image_url: mapped[key]?.image_url || current[key]?.image_url || DEFAULT_ITEMS[key].image_url }]),
      ))
    })
  }, [setStatus])

  const item = items[activeKey]
  const update = (patch: Partial<StorefrontContent>) =>
    setItems((current) => ({ ...current, [activeKey]: { ...current[activeKey], ...patch } }))

  const upload = async (file: File | undefined) => {
    if (!file || !item) return
    setUploading(true)
    const result = await uploadStorefrontImage(activeKey, file)
    if (result.ok) update({ image_url: result.url })
    setStatus(result.ok ? 'Wallpaper uploaded. Save to publish it.' : result.error)
    setUploading(false)
  }

  const save = async () => {
    if (!item) return
    const result = await saveStorefrontContent(item)
    setStatus(result.ok ? `${activeKey === 'hero' ? 'Hero' : activeKey.toUpperCase()} saved and published.` : result.error ?? 'Could not save.')
  }

  return (
    <section className="storefront-admin">
      <h3>HERO & ADS</h3>
      <div className="storefront-tabs">
        {KEYS.map((key) => (
          <button type="button" className={key === activeKey ? 'active' : ''} key={key} onClick={() => setActiveKey(key)}>
            {key === 'hero' ? 'MAIN HERO' : key.toUpperCase().replace('-', ' ')}
            {key !== 'hero' && !items[key]?.image_url && <span className="storefront-tab-status"> · PENDING</span>}
            {key !== 'hero' && items[key]?.image_url && !items[key]?.active && <span className="storefront-tab-status"> · OFF</span>}
          </button>
        ))}
      </div>
      {activeKey !== 'hero' && (
        <label className="storefront-active">
          <input type="checkbox" checked={item.active} onChange={(e) => update({ active: e.target.checked })} />
          Show this campaign on homepage and in its page
        </label>
      )}
      <div className="storefront-fields">
        <label>EYEBROW<input value={item.eyebrow} maxLength={80} onChange={(e) => update({ eyebrow: e.target.value })} /></label>
        <label>TITLE<input value={item.title} maxLength={120} onChange={(e) => update({ title: e.target.value })} /></label>
        <label className="storefront-body">TEXT<textarea value={item.body} maxLength={600} rows={3} onChange={(e) => update({ body: e.target.value })} /></label>
        <label>LINK URL<input value={item.link_url} maxLength={500} placeholder="#collection or https://..." onChange={(e) => update({ link_url: e.target.value })} /></label>
      </div>
      <label className="storefront-upload">
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(e) => void upload(e.target.files?.[0])} />
        {uploading ? 'UPLOADING…' : 'UPLOAD WALLPAPER / AD IMAGE'}
      </label>
      {item.image_url ? (
        <img className="storefront-preview" src={item.image_url} alt="Storefront preview" />
      ) : activeKey !== 'hero' ? (
        <div className="storefront-preview storefront-preview-pending">
          <strong>{activeKey.toUpperCase().replace('-', ' ')}</strong>
          <span>PENDING IMAGE</span>
        </div>
      ) : null}
      <div className="admin-actions">
        <button type="button" onClick={save} disabled={uploading}>SAVE & PUBLISH</button>
      </div>
    </section>
  )
}
