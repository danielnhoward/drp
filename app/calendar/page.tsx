import type { SVGProps } from "react";

import { listMyAvailability } from "@/lib/availability";
import { requireCompleteUser } from "@/lib/users";
import AvailabilityCard, {
  CalendarIcon,
  ClockIcon,
  RouteIcon,
  RunnerIcon,
} from "../components/availability-card";
import AddAvailability from "./add-availability";

const KEY_ITEMS: {
  Icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
  label: string;
}[] = [
  { Icon: CalendarIcon, label: "Date" },
  { Icon: ClockIcon, label: "Availability window" },
  { Icon: RouteIcon, label: "Distance" },
  { Icon: RunnerIcon, label: "Pace per km" },
];

// Reads from the database on every request rather than at build time.
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  await requireCompleteUser();
  const slots = await listMyAvailability();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">My Schedule</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          The time slots when you&apos;re free to run, we use these to match
          you with other runners.
        </p>
      </header>

      {slots.length > 0 && (
        <section
          aria-label="Key"
          className="mb-4 rounded-xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm dark:border-white/15 dark:bg-zinc-900"
        >
          <dl className="flex flex-wrap gap-x-5 gap-y-2">
            {KEY_ITEMS.map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon
                  className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400"
                  aria-hidden="true"
                />
                <dt className="sr-only">Symbol:</dt>
                <dd className="text-zinc-700 dark:text-zinc-300">{label}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {slots.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">
          No availability set yet — tap + to add a slot.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {slots.map((slot) => (
            <AvailabilityCard key={slot.id} slot={slot} />
          ))}
        </ul>
      )}

      <AddAvailability />
    </main>
  );
}
