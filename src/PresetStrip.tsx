import { useEffect, useMemo, useRef } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { render, sameAdjustments, type Adjustments, type Edit } from './adjust'
import { paint } from './image'
import type { Pixels } from './pixels'
import { PRESETS } from './presets'

function Thumb({ pixels }: { pixels: Pixels | null }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvas.current && pixels) paint(canvas.current, pixels)
  }, [pixels])
  return (
    <span className="flex size-16 items-center justify-center overflow-hidden rounded-md bg-muted sm:size-18">
      {pixels && <canvas ref={canvas} aria-hidden="true" className="size-full object-cover" />}
    </span>
  )
}

type Props = {
  thumb: Pixels | null
  edit: Edit
  onPick: (adjust: Adjustments) => void
}

/** One thumbnail per preset, rendered from the photo itself; number keys 1–9 pick them too. */
export function PresetStrip({ thumb, edit, onPick }: Props) {
  const { rotation, flipH, flipV } = edit
  const previews = useMemo(
    () => PRESETS.map((p) => (thumb ? render(thumb, { adjust: p.adjust, rotation, flipH, flipV }) : null)),
    [thumb, rotation, flipH, flipV],
  )
  const active = PRESETS.find((p) => sameAdjustments(p.adjust, edit.adjust))

  return (
    <ToggleGroup
      aria-label="Presets"
      value={active ? [active.name] : []}
      onValueChange={(v) => {
        const preset = PRESETS.find((p) => p.name === v[0])
        if (preset) onPick(preset.adjust)
      }}
      spacing={1}
      className="w-full gap-1 overflow-x-auto pb-1"
    >
      {PRESETS.map((p, i) => (
        <ToggleGroupItem
          key={p.name}
          value={p.name}
          disabled={!thumb}
          aria-keyshortcuts={String(i + 1)}
          className="h-auto flex-col gap-1.5 rounded-lg p-1.5 text-xs font-normal aria-pressed:bg-primary/10 aria-pressed:font-medium aria-pressed:text-primary aria-pressed:ring-2 aria-pressed:ring-primary"
        >
          <Thumb pixels={previews[i]} />
          {p.name}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
