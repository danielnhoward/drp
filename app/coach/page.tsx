import Link from "next/link";
import { redirect } from "next/navigation";

import { COACH_PLAN, COACH_PLAN_LENGTH } from "@/lib/coach";
import { formatDate } from "@/lib/format-date";
import { getPendingCoachedRun } from "@/lib/runs";
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
          Your coach
        </h1>
        <p className="mt-1 text-sm text-muted">
          A gentle, step-by-step plan from your first jog to a full 5K, one run
          at a time.
        </p>
      </header>

      {isStart && <CoachWelcome />}

      {pending ? (
        <section className="card flex flex-col gap-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Next run booked
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
          <Link
            href="/"
            className="tap mt-2 inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-accent-contrast transition-colors hover:brightness-110"
          >
            View on home
          </Link>
        </section>
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

// The whole arc at a glance: what's done, what's now, and what's coming. Gives
// beginners a sense of journey rather than just "Run 3 of 7".
function CoachRoadmap({ currentIndex }: { currentIndex: number }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Your plan
      </h2>
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
                {state === "done" ? "✓" : index + 1}
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
            </li>
          );
        })}
      </ol>
    </section>
  );
}
