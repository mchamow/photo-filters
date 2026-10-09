import { useCallback, useEffect, useRef, useState } from 'react'
import sampleUrl from './assets/sample.svg'
import { decode, toDataUrl, type Decoded } from './image'
import { load } from './storage'

export const IMAGE_KEY = 'photo-filters:image:v1'
export const SAMPLE_NAME = 'sample.svg'

export type Photo = Decoded & { name: string }

const removeStored = () => {
  try {
    localStorage.removeItem(IMAGE_KEY)
  } catch {
    // Nothing stored, or storage unavailable: either way nothing to remove.
  }
}

/** Strips the extension: "IMG_0042.jpeg" → "IMG_0042". */
export const baseName = (file: string) => file.replace(/\.[^.]+$/, '') || 'photo'

type Source = {
  src: Blob | string
  name: string
  /** restored: the copy saved last time; opened: a file the user picked; sample: the built-in image. */
  kind: 'restored' | 'opened' | 'sample'
}

const sample = (): Source => ({ src: sampleUrl, name: SAMPLE_NAME, kind: 'sample' })

function initialSource(): Source {
  const stored = load(IMAGE_KEY, { name: '', dataUrl: '' })
  return stored.dataUrl.startsWith('data:image/')
    ? { src: stored.dataUrl, name: stored.name || 'photo', kind: 'restored' }
    : { ...sample(), kind: 'restored' }
}

function remember(source: Source, decoded: Decoded) {
  if (source.kind === 'sample') return removeStored()
  try {
    localStorage.setItem(IMAGE_KEY, JSON.stringify({ name: source.name, dataUrl: toDataUrl(decoded.full) }))
  } catch {
    // Too big for the quota (or no storage): forget the previous photo rather than restore the wrong one.
    removeStored()
  }
}

/**
 * The photo being edited: the last one opened (kept in localStorage) or the sample.
 * `onOpened` runs when the user opens a different photo, not when the saved one is restored.
 */
export function usePhoto(onOpened: () => void) {
  const [source, setSource] = useState(initialSource)
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const onOpenedRef = useRef(onOpened)
  useEffect(() => {
    onOpenedRef.current = onOpened
  })

  useEffect(() => {
    // A newer source cancels this one, so a slow decode can't replace a newer photo.
    let current = true
    decode(source.src).then(
      (decoded) => {
        if (!current) return
        setPhoto({ ...decoded, name: source.name })
        setError(null)
        setLoading(false)
        if (source.kind !== 'restored') {
          onOpenedRef.current()
          remember(source, decoded)
        }
      },
      () => {
        if (!current) return
        if (source.kind === 'restored' && source.src !== sampleUrl) {
          // A saved copy that no longer decodes falls back to the sample instead of an error.
          removeStored()
          setSource({ ...sample(), kind: 'restored' })
          return
        }
        setError(`Couldn't open ${source.src === sampleUrl ? 'the sample' : `“${source.name}”`}. Is it an image?`)
        setLoading(false)
      },
    )
    return () => {
      current = false
    }
  }, [source])

  const openFile = useCallback((file: File) => {
    setLoading(true)
    setSource({ src: file, name: file.name || 'photo', kind: 'opened' })
  }, [])

  const openSample = useCallback(() => {
    setLoading(true)
    setSource(sample())
  }, [])

  return { photo, error, loading, openFile, openSample, dismissError: () => setError(null) }
}
