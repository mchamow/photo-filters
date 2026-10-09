import { describe, expect, it } from 'vitest'
import { blur, createPixels, histogram, orient, type Pixels } from './pixels'

/** A w×h image whose red channel numbers the pixels 0, 1, 2… in reading order. */
function numbered(w: number, h: number): Pixels {
  const px = createPixels(w, h)
  for (let i = 0; i < w * h; i++) px.data[i * 4] = i
  return px
}

/** The red channel as rows, for readable expectations. */
const rows = (px: Pixels) =>
  Array.from({ length: px.height }, (_, y) => Array.from({ length: px.width }, (_, x) => px.data[(y * px.width + x) * 4]))

describe('orient', () => {
  // 0 1 2
  // 3 4 5
  const src = numbered(3, 2)

  it('returns the source untouched when there is nothing to do', () => {
    expect(orient(src, 0, false, false)).toBe(src)
  })

  it('rotates clockwise', () => {
    expect(rows(orient(src, 90, false, false))).toEqual([
      [3, 0],
      [4, 1],
      [5, 2],
    ])
    expect(rows(orient(src, 180, false, false))).toEqual([
      [5, 4, 3],
      [2, 1, 0],
    ])
    expect(rows(orient(src, 270, false, false))).toEqual([
      [2, 5],
      [1, 4],
      [0, 3],
    ])
  })

  it('mirrors after rotating', () => {
    expect(rows(orient(src, 0, true, false))).toEqual([
      [2, 1, 0],
      [5, 4, 3],
    ])
    expect(rows(orient(src, 0, false, true))).toEqual([
      [3, 4, 5],
      [0, 1, 2],
    ])
    expect(rows(orient(src, 90, true, false))).toEqual([
      [0, 3],
      [1, 4],
      [2, 5],
    ])
  })

  it('carries all four channels', () => {
    const px = createPixels(2, 1, [10, 20, 30, 40])
    px.data.set([1, 2, 3, 4], 4)
    expect([...orient(px, 0, true, false).data]).toEqual([1, 2, 3, 4, 10, 20, 30, 40])
  })
})

describe('blur', () => {
  it('does nothing below a radius of one pixel', () => {
    const px = numbered(4, 4)
    expect(blur(px, 0.4)).toBe(px)
  })

  it('leaves a flat colour flat', () => {
    const out = blur(createPixels(9, 7, [120, 60, 30, 255]), 3)
    expect(new Set(out.data).size).toBe(4)
    expect([...out.data.slice(0, 4)]).toEqual([120, 60, 30, 255])
  })

  it('spreads a bright dot over its neighbours, symmetrically', () => {
    const px = createPixels(11, 11)
    px.data[(5 * 11 + 5) * 4] = 255
    const out = blur(px, 2)
    const red = rows(out)
    expect(red[5][5]).toBeLessThan(255)
    expect(red[5][5]).toBeGreaterThan(0)
    expect(red[5][3]).toBeGreaterThan(0)
    expect(red[5][3]).toBe(red[5][7])
    expect(red[3][5]).toBe(red[7][5])
    expect(red[0][0]).toBe(0)
  })

  it('does not change the source', () => {
    const px = numbered(5, 5)
    const copy = Uint8ClampedArray.from(px.data)
    blur(px, 2)
    expect(px.data).toEqual(copy)
  })
})

describe('histogram', () => {
  it('counts levels per channel and luminance, skipping transparent pixels', () => {
    const px = createPixels(3, 1, [255, 0, 0, 255])
    px.data.set([255, 255, 255, 255], 4)
    px.data.set([9, 9, 9, 0], 8)
    const h = histogram(px)
    expect(h.r[255]).toBe(2)
    expect(h.g[0]).toBe(1)
    expect(h.g[255]).toBe(1)
    expect(h.luma[255]).toBe(1)
    expect(h.luma[54]).toBe(1) // 0.2126 × 255
    expect(h.r[9]).toBe(0)
    expect(h.r.reduce((a, b) => a + b)).toBe(2)
  })
})
