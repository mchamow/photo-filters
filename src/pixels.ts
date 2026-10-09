/** An RGBA image in memory: the same shape as `ImageData`, but constructible anywhere (tests included). */
export type Pixels = {
  width: number
  height: number
  data: Uint8ClampedArray<ArrayBuffer>
}

export type Rotation = 0 | 90 | 180 | 270

export function createPixels(
  width: number,
  height: number,
  fill: [number, number, number, number] = [0, 0, 0, 255],
): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) data.set(fill, i)
  return { width, height, data }
}

/**
 * Rotates clockwise by `rotation`, then mirrors (flipH: left↔right, flipV: top↔bottom).
 * Works backwards from each output pixel to the source pixel it shows.
 */
export function orient(src: Pixels, rotation: Rotation, flipH: boolean, flipV: boolean): Pixels {
  if (rotation === 0 && !flipH && !flipV) return src
  const { width: w, height: h, data } = src
  const sideways = rotation === 90 || rotation === 270
  const ow = sideways ? h : w
  const oh = sideways ? w : h
  const out = new Uint8ClampedArray(data.length)
  for (let y = 0; y < oh; y++) {
    const ry = flipV ? oh - 1 - y : y
    for (let x = 0; x < ow; x++) {
      const rx = flipH ? ow - 1 - x : x
      let sx: number
      let sy: number
      if (rotation === 0) [sx, sy] = [rx, ry]
      else if (rotation === 90) [sx, sy] = [ry, h - 1 - rx]
      else if (rotation === 180) [sx, sy] = [w - 1 - rx, h - 1 - ry]
      else [sx, sy] = [w - 1 - ry, rx]
      const s = (sy * w + sx) * 4
      const o = (y * ow + x) * 4
      out[o] = data[s]
      out[o + 1] = data[s + 1]
      out[o + 2] = data[s + 2]
      out[o + 3] = data[s + 3]
    }
  }
  return { width: ow, height: oh, data: out }
}

/** One box-blur pass along a row or column, with edge pixels repeated past the border. */
function boxPass(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number, horizontal: boolean) {
  const lines = horizontal ? h : w
  const len = horizontal ? w : h
  const step = horizontal ? 4 : w * 4
  const size = 2 * r + 1
  for (let line = 0; line < lines; line++) {
    const start = horizontal ? line * w * 4 : line * 4
    for (let c = 0; c < 4; c++) {
      const at = (i: number) => src[start + Math.min(len - 1, Math.max(0, i)) * step + c]
      let sum = 0
      for (let i = -r; i <= r; i++) sum += at(i)
      for (let i = 0; i < len; i++) {
        dst[start + i * step + c] = sum / size
        sum += at(i + r + 1) - at(i - r)
      }
    }
  }
}

/** Three box blurs in a row approximate a Gaussian blur of the given radius, at a cost independent of it. */
export function blur(src: Pixels, radius: number): Pixels {
  const r = Math.round(radius)
  if (r < 1) return src
  const { width: w, height: h } = src
  const out = Uint8ClampedArray.from(src.data)
  const tmp = new Uint8ClampedArray(out.length)
  for (let pass = 0; pass < 3; pass++) {
    boxPass(out, tmp, w, h, r, true)
    boxPass(tmp, out, w, h, r, false)
  }
  return { width: w, height: h, data: out }
}

export type Histogram = { r: number[]; g: number[]; b: number[]; luma: number[] }

/** Counts of each 0–255 level per channel, plus Rec. 709 luminance. Fully transparent pixels are skipped. */
export function histogram(px: Pixels): Histogram {
  const r = new Array<number>(256).fill(0)
  const g = new Array<number>(256).fill(0)
  const b = new Array<number>(256).fill(0)
  const luma = new Array<number>(256).fill(0)
  const d = px.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    r[d[i]]++
    g[d[i + 1]]++
    b[d[i + 2]]++
    luma[Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])]++
  }
  return { r, g, b, luma }
}
