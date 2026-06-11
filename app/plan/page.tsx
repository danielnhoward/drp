import Link from "next/link";
import { redirect } from "next/navigation";

import { COACH_PLAN, COACH_PLAN_LENGTH } from "@/lib/coach";
import { formatDate, startsWithinHours } from "@/lib/format-date";
import { getPendingCoachedRun, type PendingCoachedRun } from "@/lib/runs";
import { requireCompleteUser } from "@/lib/users";
import CoachSchedule from "./coach-schedule";

// Reads from the database on every request rather than at build time.
export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const user = await requireCompleteUser();
  // Only runners actively in the program belong here; everyone else (normal
  // runners and graduates) goes home.
  if (user.coachStatus !== "active") redirect("/");

  const pending = getPendingCoachedRun(user.id);
  const sessionIndex = user.coachSessionIndex ?? 0;
  // The session they're working on now: the booked run if one's pending,
  // otherwise the next one they're about to schedule.
  const currentIndex = pending?.coachSessionIndex ?? sessionIndex;
  // A genuine first-timer: still on session 0 with nothing booked yet.
  const isStart = sessionIndex === 0 && !pending;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <header className="mb-4">
        <h1 className="text-gradient text-2xl font-semibold tracking-tight">
          Your plan
        </h1>
        <p className="mt-1 text-sm text-muted">
          A gentle, step-by-step plan from your first jog to a full 5K, one run
          at a time.
        </p>
      </header>

      {isStart && <CoachWelcome />}

      {pending ? (
        <CoachBookedRun pending={pending} />
      ) : (
        <CoachSchedule sessionIndex={sessionIndex} />
      )}

      <CoachRoadmap currentIndex={currentIndex} />
    </main>
  );
}

// One-time welcome shown to a brand-new beginner, setting expectations before
// they book their first run: how long the program is, that it adapts to them,
// and how often to run.
function CoachWelcome() {
  return (
    <section className="card mb-4 flex flex-col gap-3 border-accent/30 bg-accent/5 p-4">
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        Welcome — here&apos;s how this works
      </h2>
      <ul className="flex flex-col gap-2 text-sm text-muted">
        <li className="flex gap-2">
          <span aria-hidden="true">🗓️</span>
          <span>
            <span className="font-medium text-foreground">
              {COACH_PLAN_LENGTH} runs
            </span>{" "}
            take you from a gentle walk-jog to a continuous 5K. You book them one
            at a time, whenever suits you.
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true">🎚️</span>
          <span>
            After each run we ask how it felt —{" "}
            <span className="font-medium text-foreground">
              the plan adapts
            </span>{" "}
            to you, repeating a session if it was tough.
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true">😴</span>
          <span>
            Aim for about{" "}
            <span className="font-medium text-foreground">3 runs a week</span>{" "}
            with a rest day in between — recovery is where the progress happens.
          </span>
        </li>
      </ul>
    </section>
  );
}

// Confirmation shown after a run is booked (and whenever one is outstanding).
// Doubles as the post-schedule landing state, so it has to make clear the
// booking worked even when the run is too far out to appear on home yet — home
// only lists runs starting within the next 24 hours, which otherwise reads as
// "nothing happened".
function CoachBookedRun({ pending }: { pending: PendingCoachedRun }) {
  const onHomeNow = startsWithinHours(pending.date, pending.time, 24);

  return (
    <section className="card flex flex-col gap-2 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
        Run booked ✓
      </p>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {COACH_PLAN[pending.coachSessionIndex]?.title}
      </h2>
      <p className="text-sm text-muted">
        {formatDate(pending.date)} ·{" "}
        <span className="font-mono tnum">{pending.time}</span> · about{" "}
        <span className="font-mono tnum">{pending.distanceKm}</span> km
      </p>
      <p className="text-sm text-muted">Meet at {pending.meetAt}</p>
      {onHomeNow ? (
        <Link
          href="/"
          className="tap mt-2 inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-accent-contrast transition-colors hover:brightness-110"
        >
          View on home
        </Link>
      ) : (
        <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
          You&apos;re all set — it&apos;ll show up on your home page within 24
          hours of the start, where you can finish it.
        </p>
      )}
    </section>
  );
}

// Small lock glyph for not-yet-unlocked sessions in the roadmap. Inline SVG to
// match the app's no-icon-dependency convention.
function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

// The whole arc at a glance: what's done, what's now, and what's coming. Gives
// beginners a sense of journey rather than just "Run 3 of 7".
function CoachRoadmap({ currentIndex }: { currentIndex: number }) {
  return (
    <section className="mt-6">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
        All runs
      </h2>
      <p className="mb-2 text-xs text-muted">
        Runs unlock one at a time — finish the run marked{" "}
        <span className="font-semibold text-accent">Now</span> to open the next.
      </p>
      <ol className="card flex flex-col divide-y divide-border p-0">
        {COACH_PLAN.map((session, index) => {
          const state =
            index < currentIndex
              ? "done"
              : index === currentIndex
                ? "current"
                : "upcoming";
          return (
            <li
              key={session.title}
              className={`flex items-center gap-3 px-4 py-3 ${
                state === "upcoming" ? "opacity-60" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  state === "done"
                    ? "bg-accent/15 text-accent"
                    : state === "current"
                      ? "bg-accent text-accent-contrast"
                      : "border border-border text-muted"
                }`}
              >
                {state === "done" ? "✓" : state === "upcoming" ? <LockIcon /> : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm font-medium ${
                    state === "current" ? "text-accent" : "text-foreground"
                  }`}
                >
                  {session.title}
                </p>
                <p className="text-xs text-muted">
                  about <span className="font-mono tnum">{session.distanceKm}</span>{" "}
                  km · longest jog{" "}
                  <span className="font-mono tnum">{session.jogRepMinutes}</span>{" "}
                  min
                </p>
              </div>
              {state === "current" && (
                <span className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                  Now
                </span>
              )}
              {state === "upcoming" && (
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted">
                  Locked
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
