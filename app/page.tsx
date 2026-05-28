import RunCard from "./components/run-card";
import { getNextRun } from "@/lib/runs";
import { requireCompleteUser } from "@/lib/users";

// Reads from the database on every request rather than at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireCompleteUser();
  const nextRun = getNextRun(user.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Next run:</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Your upcoming confirmed run with another runner.
        </p>
      </header>
      {nextRun ? (
        <RunCard run={nextRun} />
      ) : (
        <p className="text-zinc-500 dark:text-zinc-400">
          No upcoming runs yet.
        </p>
      )}
    </main>
  );
}
