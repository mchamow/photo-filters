import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "cn"

type SliderProps = SliderPrimitive.Root.Props & {
  /**
   * Names the nested `<input type="range">`, which is the element screen readers and
   * tests actually see — an `aria-label` on the root only names the wrapping group.
   */
  label?: string
  /** A spoken value, e.g. `124` → "124 beats per minute". */
  valueText?: (value: number) => string
  /**
   * Fill the track from this value instead of from `min`, e.g. 0 on a −100…100 slider,
   * so a two-way adjustment shows which way it's pushed. Horizontal, single-thumb only.
   */
  origin?: number
}

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  label,
  valueText,
  origin,
  ...props
}: SliderProps) {
  // One thumb per value. A plain number is a single-thumb slider; falling back to
  // [min, max] here (as the generated component did) renders a stray second thumb.
  const _values =
    Array.isArray(value) ? value
    : typeof value === "number" ? [value]
    : Array.isArray(defaultValue) ? defaultValue
    : typeof defaultValue === "number" ? [defaultValue]
    : [min]

  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      // "edge" positions the thumb from a measured track width, which leaves it hidden
      // until a layout happens; "center" derives it from the value alone.
      thumbAlignment="center"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-muted select-none data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
        >
          {origin === undefined ? (
            <SliderPrimitive.Indicator
              data-slot="slider-range"
              className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
            />
          ) : (
            <div
              data-slot="slider-range"
              className="absolute inset-y-0 bg-primary select-none"
              style={{
                left: `${((Math.min(origin, _values[0]) - min) / (max - min)) * 100}%`,
                width: `${(Math.abs(_values[0] - origin) / (max - min)) * 100}%`,
              }}
            />
          )}
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            getAriaLabel={label ? () => label : undefined}
            getAriaValueText={valueText ? (_formatted, current) => valueText(current) : undefined}
            className="relative block size-4 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
