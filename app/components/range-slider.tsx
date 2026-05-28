"use client";

// A two-thumb range slider built from two overlapping native range inputs.
//
// Both inputs span the full [min, max] range so each thumb's visual position is
// a percentage of the same scale (and matches the fill bar between them). The
// browser positions a thumb based on the input's own min/max — narrowing one
// input's range to keep thumbs apart would make that thumb slide whenever the
// other moved, which looked like one slider dragging both sides.
//
// The no-cross rule is enforced in onChange instead: dragging a thumb past the
// other clamps its value back to `other ± step`. The input itself stays
// pointer-events-none so the two inputs don't steal each other's clicks; only
// the thumb pseudo-elements re-enable pointer events.
export default function RangeSlider({
  min,
  max,
  step,
  values,
  onChange,
  nameMin,
  nameMax,
  ariaLabelMin,
  ariaLabelMax,
}: {
  min: number;
  max: number;
  step: number;
  values: [number, number];
  onChange: (next: [number, number]) => void;
  nameMin: string;
  nameMax: string;
  ariaLabelMin: string;
  ariaLabelMax: string;
}) {
  const [lo, hi] = values;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  return (
    <div className="relative h-6 w-full">
      {/* Track background. */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-zinc-200 dark:bg-zinc-700" />
      {/* Selected range fill, between the two thumbs. */}
      <div
        className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-blue-600"
        style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
      />
      <input
        type="range"
        name={nameMin}
        aria-label={ariaLabelMin}
        min={min}
        max={max}
        step={step}
        value={lo}
        onChange={(e) =>
          onChange([Math.min(Number(e.target.value), hi - step), hi])
        }
        className={inputClass}
      />
      <input
        type="range"
        name={nameMax}
        aria-label={ariaLabelMax}
        min={min}
        max={max}
        step={step}
        value={hi}
        onChange={(e) =>
          onChange([lo, Math.max(Number(e.target.value), lo + step)])
        }
        className={inputClass}
      />
    </div>
  );
}

// Two range inputs overlap on the same track, so the input element itself must
// not capture pointer events (otherwise the topmost would steal every click);
// only the thumb pseudo-elements re-enable them so each thumb stays draggable.
const inputClass = [
  "pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent",
  "focus:outline-none",
  "[&::-webkit-slider-thumb]:pointer-events-auto",
  "[&::-webkit-slider-thumb]:appearance-none",
  "[&::-webkit-slider-thumb]:h-5",
  "[&::-webkit-slider-thumb]:w-5",
  "[&::-webkit-slider-thumb]:rounded-full",
  "[&::-webkit-slider-thumb]:bg-blue-600",
  "[&::-webkit-slider-thumb]:border-2",
  "[&::-webkit-slider-thumb]:border-white",
  "[&::-webkit-slider-thumb]:shadow",
  "[&::-moz-range-thumb]:pointer-events-auto",
  "[&::-moz-range-thumb]:appearance-none",
  "[&::-moz-range-thumb]:h-5",
  "[&::-moz-range-thumb]:w-5",
  "[&::-moz-range-thumb]:rounded-full",
  "[&::-moz-range-thumb]:bg-blue-600",
  "[&::-moz-range-thumb]:border-2",
  "[&::-moz-range-thumb]:border-white",
  "[&::-moz-range-thumb]:border-solid",
  "[&::-moz-range-thumb]:shadow",
].join(" ");
