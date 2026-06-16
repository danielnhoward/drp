import type { SVGProps } from "react";

import type { Availability } from "@/lib/availability";
import { deleteAvailabilityAction } from "@/app/schedule/actions";
import { formatDate } from "@/lib/format-date";
import RunMap from "./run-map";

export default function AvailabilityCard({ slot }: { slot: Availability }) {
  return (
    <li className="card hover-lift anim-rise p-4">
      <div className="flex items-start gap-3">
        {/* Details + map. Stacks on narrow phones (details full width above a
            full-width map) and sits side-by-side from `sm` up, so the slot data
            is never squeezed under the map on low-width screens. */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start">
          {/* The slot details. */}
          <dl className="flex min-w-0 flex-1 flex-col gap-2 text-base">
            <Detail Icon={CalendarIcon} label="Date">
              <span className="font-mono tnum">{formatDate(slot.date)}</span>
            </Detail>
            <Detail Icon={ClockIcon} label="Availability">
              <span className="font-mono tnum">
                {slot.startTime} – {slot.endTime}
              </span>
            </Detail>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Detail Icon={RouteIcon} label="Distance">
                <span className="font-mono tnum">{slot.distanceKm} km</span>
              </Detail>
              <Detail Icon={RunnerIcon} label="Pace">
                <span className="font-mono tnum">
                  {formatMMSS(slot.paceMinSeconds)} – {formatMMSS(slot.paceMaxSeconds)} /km
                </span>
              </Detail>
            </div>
          </dl>

          {/* Roughly where they'll be (the meet-up point itself is decided
              later by matching, not stored on the slot). */}
          <div className="w-full sm:w-36 sm:shrink-0">
            <p className="mb-1 text-sm text-muted">Location:</p>
            <RunMap lat={slot.lat} lon={slot.lon} label="Run location" />
          </div>
        </div>

        {/* Delete action, anchored top-right on every form factor. */}
        <div className="flex shrink-0 flex-col gap-2">
          <form action={deleteAvailabilityAction}>
            <input type="hidden" name="id" value={slot.id} />
            <button
              type="submit"
              aria-label="Delete availability"
              className="tap rounded-full border border-border p-2 text-muted transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
            >
              <TrashIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}

function Detail({
  Icon,
  label,
  children,
}: {
  Icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon
        className="h-5 w-5 shrink-0 text-muted"
        aria-hidden="true"
      />
      <span className="sr-only">{label}:</span>
      <span className="min-w-0 truncate font-medium">{children}</span>
    </div>
  );
}

const iconBase: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase} {...props}>
      <rect x={3} y={4.5} width={18} height={16} rx={2} />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  );
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase} {...props}>
      <circle cx={12} cy={12} r={9} />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function formatMMSS(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function RouteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase} {...props}>
      <path d="M3 13c2.5-3 4.5-3 7 0s4.5 3 7 0" />
      <circle cx={4} cy={18} r={1.4} />
      <circle cx={20} cy={8} r={1.4} />
    </svg>
  );
}

export function RunnerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase} {...props}>
      <circle cx={15.5} cy={5} r={1.6} />
      <path d="M14 9l-3.5 2 2 2.5V19" />
      <path d="M10.5 11 7 12l-2 3" />
      <path d="m12.5 13.5 3 1.5 2 3.5" />
    </svg>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase} {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
