export interface PackagePreset {
  preset_key: string
  label: string
  min_quantity: number
  max_quantity: number | null
  weight_grams: number
  length_cm: number
  width_cm: number
  height_cm: number
}

export interface Parcel {
  weightGrams: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

export const isValidParcel = (parcel: Parcel) =>
  Number.isInteger(parcel.weightGrams)
  && parcel.weightGrams >= 1
  && parcel.weightGrams <= 50000
  && [parcel.lengthCm, parcel.widthCm, parcel.heightCm].every((dimension) =>
    Number.isFinite(dimension) && dimension >= 0.5 && dimension <= 200,
  )

export const packageFromPreset = (preset: PackagePreset): Parcel => ({
  weightGrams: preset.weight_grams,
  lengthCm: Number(preset.length_cm),
  widthCm: Number(preset.width_cm),
  heightCm: Number(preset.height_cm),
})

export const selectPreset = (quantity: number, presets: PackagePreset[]) =>
  presets.find((preset) =>
    quantity >= preset.min_quantity && (preset.max_quantity === null || quantity <= preset.max_quantity),
  ) ?? null

export const hasPackageOverride = (parcel: Parcel, preset: PackagePreset | Parcel) => {
  const defaults = 'weight_grams' in preset ? packageFromPreset(preset) : preset
  return parcel.weightGrams !== defaults.weightGrams
    || parcel.lengthCm !== defaults.lengthCm
    || parcel.widthCm !== defaults.widthCm
    || parcel.heightCm !== defaults.heightCm
}
