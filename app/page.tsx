import RunCard from "./components/run-card";
import RunningVibeNudge from "./components/running-vibe-nudge";
import { ensureRunsBackfilled, getRunsWithin24Hours } from "@/lib/runs";
import { requireCompleteUser } from "@/lib/users";

// Reads from the database on every request rather than at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireCompleteUser();
  // Generate runs for any slots that don't have one yet (legacy / seed rows).
  await ensureRunsBackfilled();
  const runs = getRunsWithin24Hours(user.id);
  const missingVibeCount = [user.whyRun, user.hobbies, user.interests].filter(
    (value) => !value?.trim(),
  ).length;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <header className="mb-4">
        <h1 className="text-gradient text-2xl font-semibold tracking-tight">
          Next 24 hours
        </h1>
        <p className="mt-1 text-sm text-muted">
          Your confirmed runs starting within the next 24 hours.
        </p>
      </header>
      <RunningVibeNudge missingCount={missingVibeCount} />
      {runs.length > 0 ? (
        <div className="flex flex-col gap-4">
          {runs.map((run, i) => (
            <div
              key={run.id}
              className={`anim-rise anim-delay-${Math.min(i + 1, 6)}`}
            >
              <RunCard run={run} currentUserId={user.id} />
            </div>
          ))}
        </div>
      ) : (
        <div className="card mt-2 flex flex-col items-center gap-1 px-4 py-12 text-center">
          <p className="font-medium text-foreground">No upcoming runs yet.</p>
          <p className="text-sm text-muted">
            Add availability and we&apos;ll match you with a partner.
          </p>
        </div>
      )}
    </main>
  );
}
