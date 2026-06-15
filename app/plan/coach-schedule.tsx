"use client";

import { useActionState } from "react";

import { COACH_PLAN, COACH_PLAN_LENGTH } from "@/lib/coach";
import { isoToday } from "@/lib/format-date";
import MapLocationPicker from "../components/map-location-picker";
import { scheduleCoachedRunAction, type CoachScheduleState } from "./actions";

const fieldClass =
  "h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent";

export default function CoachSchedule({
  sessionIndex,
}: {
  sessionIndex: number;
}) {
  const [state, formAction, pending] = useActionState<
    CoachScheduleState,
    FormData
  >(scheduleCoachedRunAction, {});

  const index = Math.max(0, Math.min(sessionIndex, COACH_PLAN_LENGTH - 1));
  const session = COACH_PLAN[index];
  const today = isoToday();

  return (
    <div className="flex flex-col gap-4">
      {/* This run's suggestion. Lead with the distance and an easy pace — the
          point is getting a feel for both, not hitting an exact number. */}
      <section className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">
          Run {index + 1} of {COACH_PLAN_LENGTH}
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
          {session.title}
        </h2>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
          What to do
        </p>
        <p className="mt-1 text-sm text-foreground">{session.description}</p>
        <p className="mt-3 text-xs text-muted">
          About <span className="font-mono tnum">{session.distanceKm}</span> km at
          an easy pace · longest jog{" "}
          <span className="font-mono tnum">{session.jogRepMinutes}</span> min. Take
          it gently — there&apos;s no rush.
        </p>
      </section>

      {/* Pick when and where to do it; distance is fixed by the plan. */}
      <form action={formAction} className="card flex flex-col gap-4 p-4">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          When and where?
        </h3>

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
        <p className="-mt-2 text-xs text-muted">
          Try to leave a rest day since your last run. Recovery matters too.
        </p>

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

        {/* Not a <Field>: its <label> would capture map clicks (see add-availability.tsx). */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">Location</span>
          {/* Default to a central, on-the-ground city location so the starting
              pin reverse-geocodes to a sensible meeting spot. The old wide-UK
              default (54.5, -3, zoom 5) dropped the pin in the Lake District
              fells, geocoding to places like "Striding Edge" — a mountain
              scramble, not a beginner's run. */}
          <MapLocationPicker initialLat={51.5074} initialLon={-0.1278} initialZoom={12} />
        </div>

        {state.error ? (
          <p className="text-sm text-danger">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="tap mt-1 flex h-11 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-contrast transition-colors hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Scheduling…" : "Schedule this run"}
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
      <span className="text-sm font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
