import { NEUTRAL, type Adjustments } from './adjust'

export type Preset = { name: string; adjust: Adjustments }

const preset = (name: string, values: Partial<Adjustments>): Preset => ({ name, adjust: { ...NEUTRAL, ...values } })

/** Nine looks, one per number key. */
export const PRESETS: Preset[] = [
  preset('Original', {}),
  preset('Vivid', { brightness: 5, contrast: 15, saturation: 40 }),
  preset('Warm', { brightness: 5, warmth: 45, saturation: 10 }),
  preset('Cool', { contrast: 10, warmth: -40, saturation: -5 }),
  preset('Matte', { contrast: -15, fade: 45, saturation: -15 }),
  preset('Vintage', { contrast: -10, fade: 30, warmth: 20, sepia: 45, vignette: 35 }),
  preset('Mono', { contrast: 20, saturation: -100 }),
  preset('Noir', { brightness: -10, contrast: 55, saturation: -100, vignette: 60 }),
  preset('Dreamy', { brightness: 20, fade: 20, saturation: 10, warmth: 10, blur: 3 }),
]
