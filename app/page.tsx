import RunCard from "./components/run-card";
import { getNextRun } from "@/lib/runs";
import { requireCompleteUser } from "@/lib/users";

// Reads from the database on every request rather than at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  await requireCompleteUser();
  const nextRun = getNextRun();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Next run:</h1>
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
