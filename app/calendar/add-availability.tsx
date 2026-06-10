"use client";

import { useActionState, useEffect, useState } from "react";

import { isoToday } from "@/lib/format-date";
import MapLocationPicker from "../components/map-location-picker";
import RangeSlider from "../components/range-slider";
import { addAvailabilityAction, type AddAvailabilityState } from "./actions";

// Plausible pace range for the slider, in seconds per kilometre. Lower =
// faster: roughly elite at the bottom, easy/walk-jog at the top. 6-second
// granularity keeps the slider usable without being fiddly.
const PACE_MIN_SECONDS = 2 * 60 + 24; // 2:24/km
const PACE_MAX_SECONDS = 10 * 60; // 10:00/km
const PACE_STEP_SECONDS = 6;
const PACE_DEFAULT_RANGE: [number, number] = [
  4 * 60 + 30, // 4:30/km
  5 * 60 + 30, // 5:30/km
];

function formatMMSS(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const fieldClass =
  "h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent";

export default function AddAvailability() {
  const [isOpen, setOpen] = useState(false);

  // Close on Escape and lock background scroll while the modal is open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, setOpen]);

  return (
    <>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Add availability"
          className="tap flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-lg transition-colors hover:brightness-110"
        >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="h-7 w-7"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        </button>
      </div>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add availability"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
          {/* Backdrop — click to dismiss. */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default scrim backdrop-blur-sm"
          />
          {/* Fresh mount each open, so the form's action state starts clean. */}
          <AvailabilityForm onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}

function AvailabilityForm({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState<
    AddAvailabilityState,
    FormData
  >(addAvailabilityAction, {});

  // Track the pace range (in seconds per km) so we can show the bounds next to
  // the label as the user drags either thumb. Both values are submitted with
  // the form via hidden inputs inside the RangeSlider.
  const [paceRange, setPaceRange] = useState<[number, number]>(
    PACE_DEFAULT_RANGE,
  );
  const [paceMinSeconds, paceMaxSeconds] = paceRange;

  // Default the date to today and block earlier dates in the picker.
  const today = isoToday();

  // Close once the slot has been saved.
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="card anim-pop relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border p-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Add availability</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="tap rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <form
        action={formAction}
        className="flex flex-col gap-4 overflow-y-auto p-4"
      >
        <Field label="Date">
          <input
            className={fieldClass}
            type="date"
            name="date"
            defaultValue={today}
            min={today}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <input
              className={fieldClass}
              type="time"
              name="startTime"
              defaultValue="10:00"
              required
            />
          </Field>
          <Field label="To">
            <input
              className={fieldClass}
              type="time"
              name="endTime"
              defaultValue="13:00"
              required
            />
          </Field>
        </div>

        <Field label="Distance (km)">
          <input
            className={fieldClass}
            type="number"
            name="distanceKm"
            min={0.5}
            step={0.5}
            defaultValue={5}
            required
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between text-sm font-medium text-muted">
            <span>Pace range (per km)</span>
            <span className="font-mono tnum tabular-nums text-foreground">
              {formatMMSS(paceMinSeconds)} – {formatMMSS(paceMaxSeconds)} /km
            </span>
          </span>
          <RangeSlider
            min={PACE_MIN_SECONDS}
            max={PACE_MAX_SECONDS}
            step={PACE_STEP_SECONDS}
            values={paceRange}
            onChange={setPaceRange}
            nameMin="paceMinSeconds"
            nameMax="paceMaxSeconds"
            ariaLabelMin="Fastest pace"
            ariaLabelMax="Slowest pace"
          />
          <span className="flex justify-between text-xs text-muted">
            <span className="font-mono tnum">{formatMMSS(PACE_MIN_SECONDS)} /km</span>
            <span className="font-mono tnum">{formatMMSS(PACE_MAX_SECONDS)} /km</span>
          </span>
        </div>

        {/* Not a <Field> because Field renders a <label>, which would
            associate every click inside it (including on the map itself)
            with the picker's first labelable descendant — the geolocate
            button — and re-fire it on every pan. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">
            Location
          </span>
          {/* Centred on the whole of the UK (zoomed out to fit the country)
              rather than London, so users anywhere in the UK start with their
              region in view. */}
          <MapLocationPicker initialLat={54.5} initialLon={-3} initialZoom={5} />
        </div>

        {state.error ? (
          <p className="text-sm text-danger">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="tap mt-1 flex h-11 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-contrast transition-colors hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save availability"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

