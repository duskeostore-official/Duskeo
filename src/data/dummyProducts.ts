/**
 * DUMMY products — placeholders so the collection rails look full.
 * They reuse existing photos. Turn them off with SHOW_DUMMY_PRODUCTS
 * in constants/site.ts, or replace entries with real products.
 */
import type { Product, ProductPhoto, ProductTheme } from '../types'

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

const LABELS = ['Front view', 'Back view', 'Design detail', 'Additional detail']

function dummy(
  slug: string,
  name: string,
  price: number,
  theme: ProductTheme,
  launchedAt: string,
  images: string[],
): Product {
  const photos: ProductPhoto[] = images.map((src, i) => ({ src, label: LABELS[i], alt: `${name} photo ${i + 1}` }))
  return {
    slug: `dummy-${slug}`,
    name,
    price,
    theme,
    launchedAt,
    cardAlt: `${name} front view`,
    kicker: 'DUSKEO / PREVIEW',
    description: 'Placeholder product for layout preview. Replace with the real product name, photos and details.',
    photos,
    specs: [
      { label: 'COLOR', value: 'BLACK' },
      { label: 'FIT', value: 'OVERSIZED' },
      { label: 'FABRIC', value: 'COTTON · 180 GSM' },
    ],
    isDummy: true,
  }
}

export const DUMMY_PRODUCTS: Product[] = [
  dummy('shadow-orbit', 'SHADOW ORBIT TEE', 799, 'Anime', '2026-09-02', [leviBack, leviFront, leviDetail, leviModel]),
  dummy('midnight-crest', 'MIDNIGHT CREST TEE', 699, 'Samurai', '2026-09-10', [roninBack, roninFront, roninDetail, roninExtra]),
  dummy('storm-herald', 'STORM HERALD TEE', 899, 'Mythic', '2026-09-18', [cloudBack, cloudFront, cloudDetail, cloudExtra]),
  dummy('ivory-sigil', 'IVORY SIGIL TEE', 699, 'Anime', '2026-08-12', [leviDetail, leviFront, leviBack, leviModel]),
  dummy('red-horizon', 'RED HORIZON TEE', 799, 'Samurai', '2026-08-20', [roninDetail, roninFront, roninBack, roninExtra]),
  dummy('lunar-veil', 'LUNAR VEIL TEE', 899, 'Mythic', '2026-08-28', [cloudDetail, cloudFront, cloudBack, cloudExtra]),
  dummy('silent-path', 'SILENT PATH TEE', 699, 'Anime', '2026-07-15', [leviModel, leviFront, leviBack, leviDetail]),
  dummy('ember-code', 'EMBER CODE TEE', 799, 'Samurai', '2026-07-22', [roninExtra, roninFront, roninBack, roninDetail]),
  dummy('night-ascent', 'NIGHT ASCENT TEE', 899, 'Mythic', '2026-07-30', [cloudExtra, cloudFront, cloudBack, cloudDetail]),
]
