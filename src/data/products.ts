import { SHOW_DUMMY_PRODUCTS } from '../constants/site'
import type { Product, ProductSpec } from '../types'
import { DUMMY_PRODUCTS } from './dummyProducts'

import leviFront from '../assets/images/products/levi-aura/front.webp'
import leviBack from '../assets/images/products/levi-aura/back.webp'
import leviDetail from '../assets/images/products/levi-aura/detail.webp'
import leviModel from '../assets/images/products/levi-aura/model.webp'
import roninFront from '../assets/images/products/crimson-ronin/front.webp'
import roninBack from '../assets/images/products/crimson-ronin/back.webp'
import roninDetail from '../assets/images/products/crimson-ronin/detail.webp'
import roninExtra from '../assets/images/products/crimson-ronin/extra.webp'
import cloudFront from '../assets/images/products/cloud-reign/front.webp'
import cloudBack from '../assets/images/products/cloud-reign/back.webp'
import cloudDetail from '../assets/images/products/cloud-reign/detail.webp'
import cloudExtra from '../assets/images/products/cloud-reign/extra.webp'

const KICKER = 'DUSKEO / GRAPHIC COLLECTION'

const TEE_SPECS: ProductSpec[] = [
  { label: 'COLOR', value: 'BLACK' },
  { label: 'FIT', value: 'OVERSIZED' },
  { label: 'FABRIC FINISH', value: 'REGULAR BLACK' },
  { label: 'FABRIC', value: 'COTTON · 180 GSM' },
  { label: 'FIT', value: 'OVERSIZED' },
]

const REAL_PRODUCTS: Product[] = [
  {
    slug: 'levi-aura',
    name: 'LEVI AURA TEE',
    price: 699,
    theme: 'Anime',
    launchedAt: '2026-10-20',
    cardAlt: 'LEVI AURA TEE — black oversized T-shirt front view',
    kicker: KICKER,
    description:
      'A bold graphic oversized tee inspired by a relentless, forward-moving spirit. Finished in classic black with striking ivory and deep-green artwork.',
    photos: [
      { src: leviFront, label: 'Front view', alt: 'Front view' },
      { src: leviBack, label: 'Back view', alt: 'Back view' },
      { src: leviDetail, label: 'Detail view', alt: 'Print and label detail' },
      { src: leviModel, label: 'Model view', alt: 'Model wearing the tee' },
    ],
    specs: TEE_SPECS,
  },
  {
    slug: 'crimson-ronin',
    name: 'CRIMSON RONIN TEE',
    price: 699,
    theme: 'Samurai',
    launchedAt: '2026-10-24',
    cardAlt: 'CRIMSON RONIN TEE front view',
    kicker: KICKER,
    description:
      'A black oversized graphic tee with a crimson moon, a lone ronin, and atmospheric Japanese-inspired artwork. A bold back print balanced by a clean chest emblem.',
    photos: [
      { src: roninFront, label: 'Front view', alt: 'CRIMSON RONIN TEE photo 1' },
      { src: roninBack, label: 'Back view', alt: 'CRIMSON RONIN TEE photo 2' },
      { src: roninDetail, label: 'Design detail', alt: 'CRIMSON RONIN TEE photo 3' },
      { src: roninExtra, label: 'Additional detail', alt: 'CRIMSON RONIN TEE photo 4' },
    ],
    specs: TEE_SPECS,
  },
  {
    // Slug kept from the original site so existing links keep working.
    slug: 'solar-awakening',
    name: 'CLOUD REIGN TEE',
    price: 699,
    theme: 'Mythic',
    launchedAt: '2026-10-28',
    cardAlt: 'CLOUD REIGN TEE front view',
    kicker: KICKER,
    description:
      'A black oversized graphic tee with a powerful cloud-born figure and a dramatic moonlit composition. Finished with a distinctive DUSKEO front mark and statement back artwork.',
    photos: [
      { src: cloudFront, label: 'Front view', alt: 'CLOUD REIGN TEE photo 1' },
      { src: cloudBack, label: 'Back view', alt: 'CLOUD REIGN TEE photo 2' },
      { src: cloudDetail, label: 'Design detail', alt: 'CLOUD REIGN TEE photo 3' },
      { src: cloudExtra, label: 'Additional detail', alt: 'CLOUD REIGN TEE photo 4' },
    ],
    specs: TEE_SPECS,
  },
]

/** Full catalog: used by the collection, product pages and inventory admin. */
export const PRODUCTS: Product[] = SHOW_DUMMY_PRODUCTS ? [...REAL_PRODUCTS, ...DUMMY_PRODUCTS] : REAL_PRODUCTS

export const productHref =(slug: string) => `#product-${slug}`

export const findProduct = (slug: string) => PRODUCTS.find((p) => p.slug === slug)
