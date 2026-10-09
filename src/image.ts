import type { Pixels } from './pixels'

/** The browser end of the app: decoding files into pixels and pixels back into files. Mocked in tests. */

export const FULL_SIDE = 2048
export const PREVIEW_SIDE = 1080
export const THUMB_SIDE = 120

export type Decoded = {
  /** Export resolution. */
  full: Pixels
  /** What the sliders re-render live. */
  preview: Pixels
  /** For the preset thumbnails. */
  thumb: Pixels
}

async function loadImage(src: Blob | string): Promise<HTMLImageElement> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('Image has no size')
    return img
  } finally {
    if (typeof src !== 'string') URL.revokeObjectURL(url)
  }
}

function context(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D is not available')
  return ctx
}

function rasterize(source: CanvasImageSource, width: number, height: number, maxSide: number): Pixels {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = context(canvas)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { width: canvas.width, height: canvas.height, data }
}

export async function decode(src: Blob | string): Promise<Decoded> {
  const img = await loadImage(src)
  const full = rasterize(img, img.naturalWidth, img.naturalHeight, FULL_SIDE)
  return {
    full,
    preview: rasterize(img, img.naturalWidth, img.naturalHeight, PREVIEW_SIDE),
    thumb: rasterize(img, img.naturalWidth, img.naturalHeight, THUMB_SIDE),
  }
}

function toCanvas(px: Pixels, canvas = document.createElement('canvas')) {
  canvas.width = px.width
  canvas.height = px.height
  context(canvas).putImageData(new ImageData(px.data, px.width, px.height), 0, 0)
  return canvas
}

export function paint(canvas: HTMLCanvasElement, px: Pixels) {
  toCanvas(px, canvas)
}

export function encode(px: Pixels, type: string, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) =>
    toCanvas(px).toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), type, quality),
  )
}

/** A compact copy for localStorage. WebP keeps transparency; browsers that can't write it fall back to PNG. */
export function toDataUrl(px: Pixels): string {
  return toCanvas(px).toDataURL('image/webp', 0.9)
}
