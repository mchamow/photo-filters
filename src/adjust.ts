import { blur, orient, type Pixels, type Rotation } from './pixels'

export const ADJUSTMENTS = [
  { key: 'brightness', label: 'Brightness', group: 'Light', min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', group: 'Light', min: -100, max: 100 },
  { key: 'fade', label: 'Fade', group: 'Light', min: 0, max: 100 },
  { key: 'saturation', label: 'Saturation', group: 'Color', min: -100, max: 100 },
  { key: 'warmth', label: 'Warmth', group: 'Color', min: -100, max: 100 },
  { key: 'hue', label: 'Hue', group: 'Color', min: -180, max: 180, unit: '°' },
  { key: 'sepia', label: 'Sepia', group: 'Effects', min: 0, max: 100 },
  { key: 'vignette', label: 'Vignette', group: 'Effects', min: 0, max: 100 },
  { key: 'blur', label: 'Blur', group: 'Effects', min: 0, max: 20 },
] as const

export type AdjustmentKey = (typeof ADJUSTMENTS)[number]['key']
export type Adjustments = Record<AdjustmentKey, number>

/** "+15" for sliders that go both ways, "15" for those that start at zero. */
export const formatValue = (value: number, min: number, unit = '') =>
  `${min < 0 && value > 0 ? '+' : ''}${value}${unit}`

export const NEUTRAL: Adjustments = Object.fromEntries(ADJUSTMENTS.map((a) => [a.key, 0])) as Adjustments

/** Everything the user can change about a photo; undo/redo steps through these. */
export type Edit = {
  adjust: Adjustments
  rotation: Rotation
  flipH: boolean
  flipV: boolean
}

export const ORIGINAL: Edit = { adjust: NEUTRAL, rotation: 0, flipH: false, flipV: false }

/** Rotates what's on screen by 90°. With one mirror applied, that's the opposite turn of the source. */
export function rotate(edit: Edit, direction: 'left' | 'right'): Edit {
  const turn = (direction === 'right' ? 90 : 270) * (edit.flipH !== edit.flipV ? -1 : 1)
  return { ...edit, rotation: ((((edit.rotation + turn) % 360) + 360) % 360) as Rotation }
}

/** Mirrors what's on screen. Both mirrors together are a 180° turn, so that's how they're stored. */
export function flip(edit: Edit, axis: 'horizontal' | 'vertical'): Edit {
  const flipH = axis === 'horizontal' ? !edit.flipH : edit.flipH
  const flipV = axis === 'vertical' ? !edit.flipV : edit.flipV
  if (flipH && flipV)
    return { ...edit, rotation: ((edit.rotation + 180) % 360) as Rotation, flipH: false, flipV: false }
  return { ...edit, flipH, flipV }
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/** Rebuilds an Edit from anything (e.g. stored JSON), keeping only valid, in-range values. */
export function sanitizeEdit(raw: unknown): Edit {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const adj = (typeof obj.adjust === 'object' && obj.adjust !== null ? obj.adjust : {}) as Record<string, unknown>
  const adjust = { ...NEUTRAL }
  for (const a of ADJUSTMENTS) {
    const v = adj[a.key]
    if (typeof v === 'number' && Number.isFinite(v)) adjust[a.key] = clamp(Math.round(v), a.min, a.max)
  }
  const rotation = [0, 90, 180, 270].includes(obj.rotation as number) ? (obj.rotation as Rotation) : 0
  const flipH = obj.flipH === true
  const flipV = obj.flipV === true
  // Normalise a stored double mirror the same way flip() would have.
  return flipH && flipV
    ? flip({ adjust, rotation, flipH, flipV: false }, 'vertical')
    : { adjust, rotation, flipH, flipV }
}

export const sameAdjustments = (a: Adjustments, b: Adjustments) => ADJUSTMENTS.every(({ key }) => a[key] === b[key])

/**
 * A colour transform as a 3×4 affine matrix over 0–255 RGB: row i gives
 * out_i = m[i][0]·r + m[i][1]·g + m[i][2]·b + m[i][3].
 */
export type ColorMatrix = number[][]

const IDENTITY: ColorMatrix = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
]

/** `outer` applied after `inner`. */
export function compose(outer: ColorMatrix, inner: ColorMatrix): ColorMatrix {
  return outer.map((row) =>
    [0, 1, 2, 3].map(
      (j) => row[0] * inner[0][j] + row[1] * inner[1][j] + row[2] * inner[2][j] + (j === 3 ? row[3] : 0),
    ),
  )
}

const scale = (r: number, g: number, b: number, offset = 0): ColorMatrix => [
  [r, 0, 0, offset],
  [0, g, 0, offset],
  [0, 0, b, offset],
]

const mix = (a: ColorMatrix, b: ColorMatrix, t: number): ColorMatrix =>
  a.map((row, i) => row.map((v, j) => v + (b[i][j] - v) * t))

// Rec. 709 luminance weights, the same ones CSS filters use.
const LR = 0.2126
const LG = 0.7152
const LB = 0.0722

function saturate(s: number): ColorMatrix {
  return [
    [LR + (1 - LR) * s, LG - LG * s, LB - LB * s, 0],
    [LR - LR * s, LG + (1 - LG) * s, LB - LB * s, 0],
    [LR - LR * s, LG - LG * s, LB + (1 - LB) * s, 0],
  ]
}

/** Hue rotation from the Filter Effects spec (feColorMatrix type="hueRotate"). */
function hueRotate(degrees: number): ColorMatrix {
  const c = Math.cos((degrees * Math.PI) / 180)
  const s = Math.sin((degrees * Math.PI) / 180)
  return [
    [LR + c * (1 - LR) - s * LR, LG - c * LG - s * LG, LB - c * LB + s * (1 - LB), 0],
    [LR - c * LR + s * 0.143, LG + c * (1 - LG) + s * 0.14, LB - c * LB - s * 0.283, 0],
    [LR - c * LR - s * (1 - LR), LG - c * LG + s * LG, LB + c * (1 - LB) + s * LB, 0],
  ]
}

const SEPIA: ColorMatrix = [
  [0.393, 0.769, 0.189, 0],
  [0.349, 0.686, 0.168, 0],
  [0.272, 0.534, 0.131, 0],
]

/** Every colour adjustment folded into one matrix, so each pixel costs nine multiplications. */
export function colorMatrix(a: Adjustments): ColorMatrix {
  const exposure = 2 ** (a.brightness / 100) // ±1 stop
  const k = 1 + a.contrast / 100
  const lift = (0.25 * a.fade * 255) / 100
  const w = (0.2 * a.warmth) / 100
  const steps: ColorMatrix[] = [
    scale(exposure, exposure, exposure),
    scale(k, k, k, 128 * (1 - k)),
    scale(1 + w, 1, 1 - w),
    saturate(1 + a.saturation / 100),
    hueRotate(a.hue),
    mix(IDENTITY, SEPIA, a.sepia / 100),
    // Fade lifts the blacks and leaves white where it was.
    scale(1 - lift / 255, 1 - lift / 255, 1 - lift / 255, lift),
  ]
  return steps.reduce((m, step) => compose(step, m), IDENTITY)
}

export function applyMatrix(src: Pixels, m: ColorMatrix): Pixels {
  const d = src.data
  const out = new Uint8ClampedArray(d.length)
  const [[a, b, c, o1], [e, f, g, o2], [i, j, k, o3]] = m
  for (let p = 0; p < d.length; p += 4) {
    const r = d[p]
    const gr = d[p + 1]
    const bl = d[p + 2]
    out[p] = a * r + b * gr + c * bl + o1
    out[p + 1] = e * r + f * gr + g * bl + o2
    out[p + 2] = i * r + j * gr + k * bl + o3
    out[p + 3] = d[p + 3]
  }
  return { width: src.width, height: src.height, data: out }
}

/** Darkens towards the corners, up to 80% at full strength; the middle stays untouched. Mutates `px`. */
export function vignette(px: Pixels, amount: number) {
  if (amount <= 0) return
  const { width: w, height: h, data } = px
  const strength = (0.8 * amount) / 100
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  for (let y = 0; y < h; y++) {
    const dy = cy ? (y - cy) / cy : 0
    for (let x = 0; x < w; x++) {
      const dx = cx ? (x - cx) / cx : 0
      // 0 at the centre, 1 in the corners; smoothstep from 0.3 so the falloff is soft.
      const d = Math.sqrt((dx * dx + dy * dy) / 2)
      const t = Math.min(1, Math.max(0, (d - 0.3) / 0.7))
      const factor = 1 - strength * t * t * (3 - 2 * t)
      const p = (y * w + x) * 4
      data[p] *= factor
      data[p + 1] *= factor
      data[p + 2] *= factor
    }
  }
}

/** Blur is measured against a 1000px-wide photo, so the preview and the full-size export look alike. */
export const blurRadius = (amount: number, px: Pixels) => (amount * Math.max(px.width, px.height)) / 1000

/** The whole pipeline: orientation, blur, colour, vignette. Never mutates `src`. */
export function render(src: Pixels, edit: Edit): Pixels {
  const oriented = orient(src, edit.rotation, edit.flipH, edit.flipV)
  const blurred = blur(oriented, blurRadius(edit.adjust.blur, oriented))
  const out = applyMatrix(blurred, colorMatrix(edit.adjust))
  vignette(out, edit.adjust.vignette)
  return out
}
