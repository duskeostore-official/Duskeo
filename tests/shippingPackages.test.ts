import assert from 'node:assert/strict'
import test from 'node:test'
import { selectShippingPackagePreset, type ShippingPackagePreset } from '../src/utils/shippingPackages.ts'

const presets: ShippingPackagePreset[] = [
  { preset_key: 'one_tshirt', label: '1 T-shirt', min_quantity: 1, max_quantity: 1, weight_grams: 500, length_cm: 30, width_cm: 25, height_cm: 5 },
  { preset_key: 'two_tshirts', label: '2 T-shirts', min_quantity: 2, max_quantity: 2, weight_grams: 900, length_cm: 32, width_cm: 28, height_cm: 7 },
  { preset_key: 'three_or_more', label: '3 or more T-shirts', min_quantity: 3, max_quantity: null, weight_grams: 1300, length_cm: 35, width_cm: 30, height_cm: 10 },
]

test('one T-shirt selects the one-piece package preset', () => {
  const selected = selectShippingPackagePreset(1, presets)
  assert.equal(selected?.preset_key, 'one_tshirt')
  assert.deepEqual(selected && [selected.weight_grams, selected.length_cm, selected.width_cm, selected.height_cm], [500, 30, 25, 5])
})

test('two T-shirts select the two-piece package preset', () => {
  const selected = selectShippingPackagePreset(2, presets)
  assert.equal(selected?.preset_key, 'two_tshirts')
  assert.deepEqual(selected && [selected.weight_grams, selected.length_cm, selected.width_cm, selected.height_cm], [900, 32, 28, 7])
})

test('three or more T-shirts select the large package preset', () => {
  for (const quantity of [3, 5]) {
    const selected = selectShippingPackagePreset(quantity, presets)
    assert.equal(selected?.preset_key, 'three_or_more')
    assert.deepEqual(selected && [selected.weight_grams, selected.length_cm, selected.width_cm, selected.height_cm], [1300, 35, 30, 10])
  }
})

test('selection uses summed line quantities, not distinct product count', () => {
  const lines = [{ productId: 10, quantity: 1 }, { productId: 11, quantity: 2 }]
  const totalQuantity = lines.reduce((total, line) => total + line.quantity, 0)
  assert.equal(lines.length, 2)
  assert.equal(totalQuantity, 3)
  assert.equal(selectShippingPackagePreset(totalQuantity, presets)?.preset_key, 'three_or_more')
})
