"use client";

import { useActionState, useEffect, useState } from "react";

import RangeSlider from "../components/range-slider";
import { addAvailabilityAction, type AddAvailabilityState } from "./actions";

// Plausible 5k-time range for the slider, in seconds. Lower = faster: roughly
// elite at the bottom, easy/walk-jog at the top. 30-second granularity keeps
// the slider usable without being fiddly.
const FIVE_K_MIN_SECONDS = 12 * 60; // 12:00
const FIVE_K_MAX_SECONDS = 50 * 60; // 50:00
const FIVE_K_STEP_SECONDS = 30;
const FIVE_K_DEFAULT_RANGE: [number, number] = [22 * 60, 28 * 60]; // 22:00 – 28:00

function formatMMSS(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const fieldClass =
  "h-10 rounded-lg border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-black/40 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white/50";

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add availability"
        className="fixed right-4 bottom-[calc(4rem+1rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700"
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

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add availability"
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
        >
          {/* Backdrop — click to dismiss. */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-black/50"
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

  // Track the 5k-time range (in seconds) so we can show the bounds next to the
  // label as the user drags either thumb. Both values are submitted with the
  // form via hidden inputs inside the RangeSlider.
  const [fiveKRange, setFiveKRange] = useState<[number, number]>(
    FIVE_K_DEFAULT_RANGE,
  );
  const [fiveKMinSeconds, fiveKMaxSeconds] = fiveKRange;

  // Close once the slot has been saved.
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2 border-b border-black/10 p-4 dark:border-white/15">
        <h2 className="text-lg font-semibold tracking-tight">Add availability</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-50"
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
          <span className="flex items-baseline justify-between text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <span>5k time range</span>
            <span className="tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatMMSS(fiveKMinSeconds)} – {formatMMSS(fiveKMaxSeconds)}
            </span>
          </span>
          <RangeSlider
            min={FIVE_K_MIN_SECONDS}
            max={FIVE_K_MAX_SECONDS}
            step={FIVE_K_STEP_SECONDS}
            values={fiveKRange}
            onChange={setFiveKRange}
            nameMin="fiveKMinSeconds"
            nameMax="fiveKMaxSeconds"
            ariaLabelMin="Fastest 5k time"
            ariaLabelMax="Slowest 5k time"
          />
          <span className="flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
            <span>{formatMMSS(FIVE_K_MIN_SECONDS)}</span>
            <span>{formatMMSS(FIVE_K_MAX_SECONDS)}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude">
            <input
              className={fieldClass}
              type="number"
              name="lat"
              step="any"
              defaultValue={51.5073}
              required
            />
          </Field>
          <Field label="Longitude">
            <input
              className={fieldClass}
              type="number"
              name="lon"
              step="any"
              defaultValue={-0.1657}
              required
            />
          </Field>
        </div>

        {state.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 flex h-11 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
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
      <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

