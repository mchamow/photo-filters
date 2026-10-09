import { describe, expect, it } from 'vitest'
import {
  ADJUSTMENTS,
  applyMatrix,
  blurRadius,
  colorMatrix,
  compose,
  flip,
  formatValue,
  NEUTRAL,
  ORIGINAL,
  render,
  rotate,
  sanitizeEdit,
  vignette,
  type Adjustments,
  type Edit,
} from './adjust'
import { createPixels, orient, type Pixels } from './pixels'

const look = (values: Partial<Adjustments>): Adjustments => ({ ...NEUTRAL, ...values })

/** Runs one RGB colour through the colour adjustments. */
function color(rgb: [number, number, number], values: Partial<Adjustments>) {
  const px = createPixels(1, 1, [...rgb, 255])
  return [...applyMatrix(px, colorMatrix(look(values))).data.slice(0, 3)]
}

describe('colorMatrix', () => {
  it('is the identity with every slider at zero', () => {
    expect(color([12, 130, 250], {})).toEqual([12, 130, 250])
  })

  it('brightness is ±1 stop of exposure', () => {
    expect(color([50, 100, 120], { brightness: 100 })).toEqual([100, 200, 240])
    expect(color([50, 100, 120], { brightness: -100 })).toEqual([25, 50, 60])
  })

  it('contrast pushes away from (or pulls towards) mid-grey', () => {
    expect(color([128, 100, 200], { contrast: 100 })).toEqual([128, 72, 255])
    expect(color([0, 128, 255], { contrast: -100 })).toEqual([128, 128, 128])
  })

  it('fade lifts the blacks but keeps white', () => {
    expect(color([0, 255, 0], { fade: 100 })).toEqual([64, 255, 64])
  })

  it('full desaturation gives grey of the same luminance', () => {
    const [r, g, b] = color([200, 40, 90], { saturation: -100 })
    expect(r).toBe(g)
    expect(g).toBe(b)
    expect(r).toBe(Math.round(0.2126 * 200 + 0.7152 * 40 + 0.0722 * 90))
  })

  it('leaves greys grey under saturation, hue and warmth-free changes', () => {
    expect(color([90, 90, 90], { saturation: 80, hue: 120 })).toEqual([90, 90, 90])
  })

  it('warmth adds red and removes blue', () => {
    const [r, g, b] = color([100, 100, 100], { warmth: 50 })
    expect(r).toBe(110)
    expect(g).toBe(100)
    expect(b).toBe(90)
  })

  it('rotates hue: half a turn moves red towards cyan', () => {
    const [r, g, b] = color([200, 30, 30], { hue: 180 })
    expect(r).toBeLessThan(g)
    expect(r).toBeLessThan(b)
    // Half a turn either way lands in the same place.
    expect(color([200, 30, 30], { hue: -180 })).toEqual([r, g, b])
  })

  it('full sepia uses the classic sepia matrix', () => {
    expect(color([100, 150, 200], { sepia: 100 })).toEqual([192, 171, 134])
  })
})

describe('compose', () => {
  it('applies the inner matrix first, offsets included', () => {
    const double = [
      [2, 0, 0, 0],
      [0, 2, 0, 0],
      [0, 0, 2, 0],
    ]
    const plus10 = [
      [1, 0, 0, 10],
      [0, 1, 0, 10],
      [0, 0, 1, 10],
    ]
    expect(compose(double, plus10)[0]).toEqual([2, 0, 0, 20])
    expect(compose(plus10, double)[0]).toEqual([2, 0, 0, 10])
  })
})

describe('vignette', () => {
  it('darkens the corners and leaves the centre alone', () => {
    const px = createPixels(21, 21, [200, 200, 200, 255])
    vignette(px, 100)
    const at = (x: number, y: number) => px.data[(y * 21 + x) * 4]
    expect(at(10, 10)).toBe(200)
    expect(at(0, 0)).toBe(40)
    expect(at(0, 10)).toBeLessThan(200)
    expect(at(0, 10)).toBeGreaterThan(40)
    expect(px.data[3]).toBe(255)
  })

  it('does nothing at zero', () => {
    const px = createPixels(5, 5, [200, 200, 200, 255])
    vignette(px, 0)
    expect(new Set(px.data).size).toBe(2)
  })
})

describe('render', () => {
  it('orients, adjusts and never touches the source', () => {
    const src = createPixels(4, 2, [100, 100, 100, 255])
    const copy = Uint8ClampedArray.from(src.data)
    const out = render(src, { ...ORIGINAL, rotation: 90, adjust: look({ brightness: 100 }) })
    expect([out.width, out.height]).toEqual([2, 4])
    expect(out.data[0]).toBe(200)
    expect(src.data).toEqual(copy)
  })

  it('scales the blur with the image so previews match exports', () => {
    expect(blurRadius(10, createPixels(1000, 500))).toBe(10)
    expect(blurRadius(10, createPixels(500, 2000))).toBe(20)
  })
})

describe('rotate and flip', () => {
  /** 0 1 2 / 3 4 5 in the red channel. */
  const src: Pixels = createPixels(3, 2)
  for (let i = 0; i < 6; i++) src.data[i * 4] = i
  const shown = (e: Edit) => orient(src, e.rotation, e.flipH, e.flipV)

  const edits: Edit[] = []
  for (const rotation of [0, 90, 180, 270] as const)
    for (const flipH of [false, true]) for (const flipV of [false, true]) edits.push({ ...ORIGINAL, rotation, flipH, flipV })

  it('rotate turns whatever is on screen, mirrored or not', () => {
    for (const e of edits) {
      expect(shown(rotate(e, 'right'))).toEqual(orient(shown(e), 90, false, false))
      expect(shown(rotate(e, 'left'))).toEqual(orient(shown(e), 270, false, false))
    }
  })

  it('flip mirrors whatever is on screen', () => {
    for (const e of edits) {
      expect(shown(flip(e, 'horizontal'))).toEqual(orient(shown(e), 0, true, false))
      expect(shown(flip(e, 'vertical'))).toEqual(orient(shown(e), 0, false, true))
    }
  })

  it('stores a double mirror as a half turn', () => {
    expect(flip({ ...ORIGINAL, flipH: true }, 'vertical')).toMatchObject({ rotation: 180, flipH: false, flipV: false })
  })

  it('four turns come back to the start', () => {
    let e: Edit = { ...ORIGINAL, flipH: true }
    for (let i = 0; i < 4; i++) e = rotate(e, 'right')
    expect(e).toEqual({ ...ORIGINAL, flipH: true })
  })
})

describe('sanitizeEdit', () => {
  it('falls back to the original for junk', () => {
    expect(sanitizeEdit(null)).toEqual(ORIGINAL)
    expect(sanitizeEdit('nope')).toEqual(ORIGINAL)
    expect(sanitizeEdit({ adjust: [1, 2] })).toEqual(ORIGINAL)
  })

  it('keeps valid values, clamps and rounds numbers, drops the rest', () => {
    const edit = sanitizeEdit({
      adjust: { brightness: 40, contrast: 999, hue: -12.6, blur: 'lots', fade: Number.NaN, extra: 5 },
      rotation: 90,
      flipH: true,
      flipV: 'yes',
    })
    expect(edit).toEqual({
      adjust: look({ brightness: 40, contrast: 100, hue: -13 }),
      rotation: 90,
      flipH: true,
      flipV: false,
    })
  })

  it('rejects odd rotations and normalises a double mirror', () => {
    expect(sanitizeEdit({ rotation: 45 }).rotation).toBe(0)
    expect(sanitizeEdit({ rotation: 90, flipH: true, flipV: true })).toMatchObject({ rotation: 270, flipH: false, flipV: false })
  })
})

it('formats values with a sign only for two-way sliders', () => {
  expect(formatValue(15, -100)).toBe('+15')
  expect(formatValue(-15, -100)).toBe('-15')
  expect(formatValue(0, -100)).toBe('0')
  expect(formatValue(15, 0)).toBe('15')
  expect(formatValue(30, -180, '°')).toBe('+30°')
})

it('every adjustment has a zero inside its range', () => {
  for (const a of ADJUSTMENTS) expect(a.min <= 0 && a.max > 0).toBe(true)
})
