import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { ImageIcon, LoaderCircle } from 'lucide-react'
import { paint } from './image'
import type { Pixels } from './pixels'

type Props = {
  after: Pixels | null
  /** The unedited photo (same orientation), shown while comparing or peeking. */
  before: Pixels | null
  compare: boolean
  peek: boolean
  /** Where the before/after split sits, 0–100 from the left. */
  split: number
  onSplit: (split: number) => void
  loading: boolean
}

function Canvas({
  pixels,
  label,
  className,
  style,
}: {
  pixels: Pixels
  label: string
  className?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) paint(ref.current, pixels)
  }, [pixels])
  return <canvas ref={ref} role="img" aria-label={label} className={className} style={style} />
}

const Tag = ({ children, className }: { children: string; className: string }) => (
  <span
    className={`pointer-events-none absolute top-2 rounded-md bg-black/55 px-2 py-0.5 text-xs font-medium text-white ${className}`}
  >
    {children}
  </span>
)

const clamp = (n: number) => Math.min(100, Math.max(0, n))

export function Stage({ after, before, compare, peek, split, onSplit, loading }: Props) {
  const frame = useRef<HTMLDivElement>(null)
  const showBefore = before && (peek || compare)

  const splitAt = (e: PointerEvent) => {
    const rect = frame.current?.getBoundingClientRect()
    if (rect && rect.width > 0) onSplit(Math.round(clamp(((e.clientX - rect.left) / rect.width) * 100)))
  }

  const onHandleKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2
    const next =
      e.key === 'ArrowLeft' || e.key === 'ArrowDown'
        ? split - step
        : e.key === 'ArrowRight' || e.key === 'ArrowUp'
          ? split + step
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? 100
              : null
    if (next === null) return
    e.preventDefault()
    e.stopPropagation()
    onSplit(clamp(next))
  }

  return (
    <div className="checkerboard relative flex min-h-64 items-center justify-center overflow-hidden rounded-xl p-2 ring-1 ring-foreground/10 sm:min-h-96 sm:p-4">
      {after ? (
        <div
          ref={frame}
          className={`relative max-w-full touch-none select-none ${compare && !peek ? 'cursor-ew-resize' : ''}`}
          onPointerDown={(e) => {
            if (!compare || peek) return
            e.currentTarget.setPointerCapture(e.pointerId)
            splitAt(e)
          }}
          onPointerMove={(e) => {
            if (compare && !peek && e.currentTarget.hasPointerCapture(e.pointerId)) splitAt(e)
          }}
          // The last move can arrive coalesced after the button is up, so take the final spot from pointerup too.
          onPointerUp={(e) => {
            if (compare && !peek && e.currentTarget.hasPointerCapture(e.pointerId)) splitAt(e)
          }}
        >
          <Canvas
            pixels={after}
            label="Edited photo"
            className="block h-auto max-h-[min(70vh,720px)] w-auto max-w-full shadow-lg"
          />
          {showBefore && (
            <Canvas
              pixels={before}
              label="Original photo"
              className="absolute inset-0 size-full"
              style={peek ? undefined : { clipPath: `inset(0 ${100 - split}% 0 0)` }}
            />
          )}
          {peek && before && <Tag className="left-2">Before</Tag>}
          {compare && !peek && before && (
            <>
              <Tag className="left-2">Before</Tag>
              <Tag className="right-2">After</Tag>
              <div
                className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_4px_rgba(0,0,0,0.6)]"
                style={{ left: `${split}%` }}
              >
                <div
                  role="slider"
                  tabIndex={0}
                  aria-label="Before/after split"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={split}
                  aria-valuetext={`${split}% original`}
                  onKeyDown={onHandleKey}
                  className="pointer-events-auto absolute top-1/2 left-1/2 flex size-8 -translate-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-xs text-neutral-700 shadow-md outline-none focus-visible:ring-3 focus-visible:ring-ring"
                >
                  ‹›
                </div>
              </div>
            </>
          )}
        </div>
      ) : loading ? (
        <LoaderCircle aria-label="Loading photo" className="size-8 animate-spin text-muted-foreground" />
      ) : (
        <ImageIcon aria-hidden="true" className="size-10 text-muted-foreground" />
      )}
    </div>
  )
}
