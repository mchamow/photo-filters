import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { ADJUSTMENTS, formatValue, type AdjustmentKey, type Adjustments } from './adjust'

const GROUPS = ['Light', 'Color', 'Effects'] as const

type Props = {
  adjust: Adjustments
  disabled: boolean
  onChange: (key: AdjustmentKey, value: number) => void
  onCommit: () => void
}

/** The sliders, grouped. Each value doubles as a button that resets its slider. */
export function AdjustPanel({ adjust, disabled, onChange, onCommit }: Props) {
  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map((group) => (
        <fieldset key={group} className="flex flex-col gap-3.5">
          <legend className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{group}</legend>
          {ADJUSTMENTS.filter((a) => a.group === group).map((a) => {
            const value = adjust[a.key]
            const unit = 'unit' in a ? a.unit : ''
            return (
              <div key={a.key} className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="font-normal">{a.label}</Label>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(a.key, 0)
                      onCommit()
                    }}
                    disabled={disabled || value === 0}
                    aria-label={`Reset ${a.label}`}
                    title={value === 0 ? undefined : `Reset ${a.label}`}
                    className="rounded px-1 text-sm text-muted-foreground tabular-nums outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 enabled:cursor-pointer disabled:opacity-100 [&:not(:disabled)]:text-foreground"
                  >
                    {formatValue(value, a.min, unit)}
                  </button>
                </div>
                <Slider
                  label={a.label}
                  valueText={(v) => formatValue(v, a.min, unit === '°' ? ' degrees' : '')}
                  min={a.min}
                  max={a.max}
                  origin={a.min < 0 ? 0 : undefined}
                  step={1}
                  value={value}
                  disabled={disabled}
                  onValueChange={(next) => onChange(a.key, Array.isArray(next) ? next[0] : next)}
                  // A drag ends on pointer up; a run of arrow keys ends when focus moves on.
                  onPointerUp={onCommit}
                  onBlur={onCommit}
                  className="py-1"
                />
              </div>
            )
          })}
        </fieldset>
      ))}
    </div>
  )
}
