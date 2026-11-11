import { useState } from 'react'
import { SIZES } from '../../constants/site'
import { useInventory } from '../../context/inventory/useInventory'
import { useCatalog } from '../../context/catalog/useCatalog'
import { useCart } from '../../context/cart/useCart'
import { STORE_COLLECTIONS } from '../../data/campaignCollections'
import { supabase } from '../../lib/supabase'
import type { Product, Size, Stock } from '../../types'
import { zeroStock } from '../../utils/inventory'
import { StorefrontAdmin } from './StorefrontAdmin'
import { OrdersAdmin } from './OrdersAdmin'
import { CustomDesignRequestsAdmin } from './CustomDesignRequestsAdmin'

export function InventoryAdmin({ onClose }: { onClose: () => void }) {
  const [activeSection, setActiveSection] = useState<'inventory' | 'orders' | 'custom-design'>('inventory')
  const inventory = useInventory()
  const catalog = useCatalog()
  const cart = useCart()
  // Inputs edit a draft; nothing changes on the site until SAVE.
  const [draft, setDraft] = useState<Stock>(inventory.stock)
  const [status, setStatus] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('699')
  const [selectedCollections, setSelectedCollections] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<{ src: string; name: string }[]>([])
  const [uploading, setUploading] = useState(false)

  const setQty = (product: string, size: Size, value: string) =>
    setDraft((d) => ({ ...d, [product]: { ...d[product], [size]: Math.max(0, Math.floor(Number(value) || 0)) } }))

  const save = async () => {
    const result = await inventory.replace(draft)
    setStatus(result.ok ? 'Stock saved in Supabase. Product availability has been refreshed.' : result.error ?? 'Could not save stock.')
  }

  const reset = async () => {
    const result = await inventory.reset()
    setDraft(zeroStock(catalog.products.map((product) => product.name)))
    setStatus(result.ok ? 'All stock quantities reset to zero in Supabase.' : result.error ?? 'Could not reset stock.')
  }

  const readPhoto = (file: File) =>
    new Promise<{ src: string; name: string }>((resolve, reject) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        reject(new Error(`${file.name} is not a JPG, PNG, or WebP image.`))
        return
      }
      if (file.size > 1_500_000) {
        reject(new Error(`${file.name} is larger than 1.5 MB.`))
        return
      }
      const reader = new FileReader()
      reader.onload = () => resolve({ src: String(reader.result), name: file.name })
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`))
      reader.readAsDataURL(file)
    })

  const uploadPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    const remaining = 4 - photos.length
    if (remaining <= 0) {
      setStatus('A product can have up to 4 photos.')
      return
    }
    setUploading(true)
    try {
      const selected = Array.from(files).slice(0, remaining)
      const loaded = await Promise.all(selected.map(readPhoto))
      setPhotos((current) => [...current, ...loaded].slice(0, 4))
      setStatus(`${loaded.length} photo${loaded.length === 1 ? '' : 's'} ready.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Photo upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const addProduct = async () => {
    const cleanName = name.trim().replace(/\s+/g, ' ')
    const numericPrice = Math.floor(Number(price))
    if (!cleanName) return setStatus('Enter a product name.')
    if (!Number.isFinite(numericPrice) || numericPrice < 1 || numericPrice > 1_000_000) {
      return setStatus('Enter a valid price from 1 to 1000000.')
    }
    if (!description.trim()) return setStatus('Enter a product description.')
    if (!photos.length) return setStatus('Upload at least one product photo.')

    const slugBase = cleanName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!slugBase) return setStatus('Product name must contain letters or numbers.')
    const existingSlugs = new Set(catalog.products.map((product) => product.slug))
    let slug = slugBase
    let suffix = 2
    while (existingSlugs.has(slug)) slug = `${slugBase}-${suffix++}`

    const product: Product = {
      slug,
      name: cleanName.toUpperCase(),
      price: numericPrice,
      theme: 'Anime',
      launchedAt: new Date().toISOString().slice(0, 10),
      cardAlt: cleanName,
      description: description.trim(),
      kicker: 'DUSKEO / GRAPHIC COLLECTION',
      photos: photos.map((photo, index) => ({
        src: photo.src,
        label: index === 0 ? 'Front view' : `View ${index + 1}`,
        alt: `${cleanName}${index === 0 ? ' front view' : ` view ${index + 1}`}`,
      })),
      specs: [
        { label: 'COLOR', value: 'BLACK' },
        { label: 'FIT', value: 'OVERSIZED' },
        { label: 'FABRIC', value: 'COTTON · 180 GSM' },
      ],
    }

    const result = await catalog.addProduct(product)
    if (!result.ok) return setStatus(result.error ?? 'Could not add the product.')

    let collectionStatus = ''
    if (selectedCollections.length) {
      const { data: savedProduct, error: productLookupError } = await supabase
        .from('products')
        .select('id')
        .eq('slug', product.slug)
        .single()

      const { data: collections, error: collectionsLookupError } = await supabase
        .from('collections')
        .select('id, slug')
        .in('slug', selectedCollections)

      if (productLookupError || !savedProduct) {
        collectionStatus = `Product added, but its collection assignment failed: ${productLookupError?.message ?? 'Could not find the saved product.'}`
      } else if (collectionsLookupError) {
        collectionStatus = `Product added, but collections could not be loaded: ${collectionsLookupError.message}`
      } else {
        const availableCollections = new Map((collections ?? []).map((collection) => [collection.slug, collection.id]))
        const failedCollections: string[] = []
        for (const collectionSlug of selectedCollections) {
          const collectionId = availableCollections.get(collectionSlug)
          if (!collectionId) {
            failedCollections.push(collectionSlug)
            continue
          }

          const { data: lastProduct, error: orderError } = await supabase
            .from('collection_products')
            .select('sort_order')
            .eq('collection_id', collectionId)
            .order('sort_order', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (orderError) {
            failedCollections.push(collectionSlug)
            continue
          }

          const { error: assignmentError } = await supabase.from('collection_products').insert({
            collection_id: collectionId,
            product_id: savedProduct.id,
            sort_order: (lastProduct?.sort_order ?? -1) + 1,
          })
          if (assignmentError) failedCollections.push(collectionSlug)
        }

        if (failedCollections.length) {
          const failedNames = STORE_COLLECTIONS
            .filter((collection) => failedCollections.includes(collection.slug))
            .map((collection) => collection.title)
          collectionStatus = `Product added, but could not add it to: ${failedNames.join(', ')}. Check the collection setup and try again.`
        }
      }
    }

    setDraft((current) => ({
      ...current,
      [product.name]: Object.fromEntries(SIZES.map((size) => [size, 0])) as Record<Size, number>,
    }))
    setName('')
    setPrice('699')
    setDescription('')
    setPhotos([])
    setSelectedCollections([])
    setStatus(collectionStatus || `Product "${product.name}" uploaded successfully.`)
  }

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    const nextStock = { ...inventory.stock }
    delete nextStock[product.name]
    await inventory.replace(nextStock)
    cart.remove(product.name)
    const result = await catalog.deleteProduct(product.slug)
    setDraft((current) => {
      const next = { ...current }
      delete next[product.name]
      return next
    })
    setStatus(result.ok ? `Product "${product.name}" deleted.` : result.error ?? 'Could not delete the product.')
  }

  return (
    <div
      className="inventory-admin open"
      role="dialog"
      aria-modal="true"
      aria-label="Inventory management"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="inventory-admin-panel">
        <div className="inventory-admin-head">
          <h2>DUSKEO / ADMIN CONTROL</h2>
          <button type="button" aria-label="Close inventory admin" onClick={onClose}>
            ×
          </button>
        </div>
        <nav className="admin-sections" aria-label="Admin sections">
          <button
            type="button"
            className={activeSection === 'inventory' ? 'active' : ''}
            aria-pressed={activeSection === 'inventory'}
            onClick={() => setActiveSection('inventory')}
          >
            INVENTORY & STOREFRONT
          </button>
          <button
            type="button"
            className={activeSection === 'orders' ? 'active' : ''}
            aria-pressed={activeSection === 'orders'}
            onClick={() => setActiveSection('orders')}
          >
            ORDERS
          </button>
          <button
            type="button"
            className={activeSection === 'custom-design' ? 'active' : ''}
            aria-pressed={activeSection === 'custom-design'}
            onClick={() => setActiveSection('custom-design')}
          >
            CUSTOM DESIGN
          </button>
        </nav>
        {activeSection === 'orders' ? <OrdersAdmin /> : activeSection === 'custom-design' ? <CustomDesignRequestsAdmin /> : (
          <>
        <p className="admin-warning">
          Set the real available quantity for every product and size. Stock is saved in Supabase and shared across
          all visitors. Access is restricted to authenticated administrator accounts. Initial quantities are set
          to zero until you enter inventory.
        </p>
        <StorefrontAdmin setStatus={setStatus} />
        <section className="product-admin-form" aria-labelledby="upload-product-heading">
          <h3 id="upload-product-heading">ADD PRODUCT</h3>
          <div className="product-admin-fields">
            <label>
              PRODUCT NAME
              <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="MIDNIGHT TEE" />
            </label>
            <label>
              PRICE (₹)
              <input type="number" min={1} max={1000000} step={1} value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <fieldset className="product-admin-collections">
              <legend>ADD TO COLLECTIONS</legend>
              <div>
                {STORE_COLLECTIONS.map((collection) => (
                  <label key={collection.slug}>
                    <input
                      type="checkbox"
                      checked={selectedCollections.includes(collection.slug)}
                      onChange={(event) => {
                        setSelectedCollections((current) => event.target.checked
                          ? [...current, collection.slug]
                          : current.filter((slug) => slug !== collection.slug))
                      }}
                    />
                    {collection.title}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="product-admin-description">
              DESCRIPTION
              <textarea value={description} maxLength={600} rows={3} onChange={(e) => setDescription(e.target.value)} />
            </label>
          </div>
          <label className="product-photo-upload">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={uploading || photos.length >= 4}
              onChange={(e) => void uploadPhotos(e.target.files)}
            />
            {uploading ? 'READING PHOTOS…' : photos.length ? `ADD MORE (${photos.length}/4)` : 'UPLOAD PHOTOS (1–4)'}
          </label>
          {photos.length > 0 && (
            <div className="product-photo-previews">
              {photos.map((photo, index) => (
                <div className="product-photo-preview" key={`${photo.name}-${index}`}>
                  <img src={photo.src} alt={photo.name} />
                  <button type="button" aria-label={`Remove ${photo.name}`} onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <button type="button" className="product-upload-button" onClick={addProduct} disabled={uploading}>
            UPLOAD PRODUCT
          </button>
        </section>
        <table className="inventory-table">
          <thead>
            <tr>
              <th>PRODUCT</th>
              {SIZES.map((s) => (
                <th key={s}>{s}</th>
              ))}
              <th>DELETE</th>
            </tr>
          </thead>
          <tbody>
            {catalog.products.map((product) => (
              <tr key={product.slug}>
                <td>
                  <span>{product.name}</span>
                </td>
                {SIZES.map((s) => (
                  <td key={s}>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      aria-label={`${product.name} ${s} stock`}
                      value={draft[product.name]?.[s] ?? 0}
                      onChange={(e) => setQty(product.name, s, e.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="product-delete-button"
                    aria-label={`Delete ${product.name}`}
                    onClick={() => deleteProduct(product)}
                  >
                    DELETE
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="admin-actions">
          <button type="button" onClick={save}>
            SAVE STOCK
          </button>
          <button type="button" onClick={reset}>
            RESET TO ZERO
          </button>
        </div>
        <p className="admin-status" aria-live="polite">
          {status}
        </p>
          </>
        )}
      </div>
    </div>
  )
}
