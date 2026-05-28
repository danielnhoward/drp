import { listMyAvailability } from "@/lib/availability";
import { requireCompleteUser } from "@/lib/users";
import AvailabilityCard from "../components/availability-card";
import AddAvailability from "./add-availability";

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
