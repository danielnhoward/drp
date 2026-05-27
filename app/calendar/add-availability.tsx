"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import type { SVGProps } from "react";

import { addAvailabilityAction, type AddAvailabilityState } from "./actions";

const SKILL_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
const PARTNER_OPTIONS = ["Random", "Friends"];

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

type GeoStatus = "loading" | "ready" | "error";

function AvailabilityForm({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState<
    AddAvailabilityState,
    FormData
  >(addAvailabilityAction, {});

  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null,
  );
  // This form only mounts client-side (after the + is clicked), so reading
  // navigator here is safe and avoids a synchronous setState in the effect.
  const [geoStatus, setGeoStatus] = useState<GeoStatus>(() =>
    typeof navigator !== "undefined" && navigator.geolocation
      ? "loading"
      : "error",
  );

  // Read the browser's current position. Only the async callbacks set state, so
  // this can be called from the mount effect without triggering cascading
  // renders. The meet-up point is decided later by matching; here we just need
  // where the runner is right now.
  const requestLocation = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoStatus("ready");
      },
      () => setGeoStatus("error"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  const retryLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setGeoStatus("loading");
    requestLocation();
  }, [requestLocation]);

  // Ask for the position once when the form opens.
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      requestLocation();
    }
  }, [requestLocation]);

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

        <div className="grid grid-cols-2 gap-3">
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
          <Field label="Skill level">
            <select className={fieldClass} name="skillLevel" defaultValue="Beginner">
              {SKILL_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Match with">
          <select className={fieldClass} name="partnerPref" defaultValue="Random">
            {PARTNER_OPTIONS.map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Current location
          </span>
          <LocationStatus status={geoStatus} coords={coords} onRetry={retryLocation} />
          {coords && (
            <>
              <input type="hidden" name="lat" value={coords.lat} />
              <input type="hidden" name="lon" value={coords.lon} />
            </>
          )}
        </div>

        {state.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !coords}
          className="mt-1 flex h-11 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save availability"}
        </button>
      </form>
    </div>
  );
}

function LocationStatus({
  status,
  coords,
  onRetry,
}: {
  status: GeoStatus;
  coords: { lat: number; lon: number } | null;
  onRetry: () => void;
}) {
  const boxClass =
    "flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-black/[.02] px-3 py-2.5 text-sm dark:border-white/15 dark:bg-white/[.03]";

  if (status === "ready" && coords) {
    return (
      <div className={boxClass}>
        <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
          <PinIcon className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          Using your location ({coords.lat.toFixed(4)}, {coords.lon.toFixed(4)})
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Update
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={boxClass}>
        <span className="text-red-600 dark:text-red-400">
          Couldn&apos;t get your location.
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={boxClass}>
      <span className="text-zinc-500 dark:text-zinc-400">
        Getting your location…
      </span>
    </div>
  );
}

function PinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx={12} cy={10} r={2.5} />
    </svg>
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
