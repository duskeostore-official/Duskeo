export type PackagePresetKey = 'one_tshirt' | 'two_tshirts' | 'three_or_more'

export interface ShippingPackagePreset {
  preset_key: PackagePresetKey
  label: string
  min_quantity: number
  max_quantity: number | null
  weight_grams: number
  length_cm: number
  width_cm: number
  height_cm: number
}

export interface ShippingPackage {
  weightGrams: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

export const selectShippingPackagePreset = (
  quantity: number,
  presets: ShippingPackagePreset[],
) => presets.find((preset) =>
  quantity >= preset.min_quantity && (preset.max_quantity === null || quantity <= preset.max_quantity),
) ?? null

export const validateShippingPackage = (parcel: ShippingPackage) =>
  Number.isInteger(parcel.weightGrams)
  && parcel.weightGrams >= 1
  && parcel.weightGrams <= 50000
  && [parcel.lengthCm, parcel.widthCm, parcel.heightCm].every((dimension) =>
    Number.isFinite(dimension) && dimension >= 0.5 && dimension <= 200,
  )
