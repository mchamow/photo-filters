import type { Histogram as Counts } from './pixels'

const HEIGHT = 100

/** Tallest bar ignoring pure black and white, which often spike and would flatten everything else. */
function peak(h: Counts) {
  let max = 1
  for (const channel of [h.r, h.g, h.b, h.luma]) for (let i = 1; i < 255; i++) max = Math.max(max, channel[i])
  return max
}

function area(counts: number[], max: number) {
  const points = counts.map((c, i) => `L${i},${(HEIGHT - Math.min(1, c / max) * HEIGHT).toFixed(1)}`).join('')
  return `M0,${HEIGHT}${points}L255,${HEIGHT}Z`
}

export function Histogram({ counts }: { counts: Counts | null }) {
  const max = counts ? peak(counts) : 1
  return (
    <svg
      role="img"
      aria-label="Histogram of the edited photo"
      viewBox={`0 0 255 ${HEIGHT}`}
      preserveAspectRatio="none"
      className="h-20 w-full rounded-md bg-muted/60"
    >
      {counts && (
        <>
          <path d={area(counts.r, max)} className="fill-red-500/60 mix-blend-multiply dark:mix-blend-screen" />
          <path d={area(counts.g, max)} className="fill-green-500/60 mix-blend-multiply dark:mix-blend-screen" />
          <path d={area(counts.b, max)} className="fill-blue-500/60 mix-blend-multiply dark:mix-blend-screen" />
          <path
            d={area(counts.luma, max)}
            className="fill-none stroke-foreground/70"
            strokeWidth={1.25}
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
  )
}
