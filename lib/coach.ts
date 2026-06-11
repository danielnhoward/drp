// The getting-started plan for newcomers: a gentle on-ramp that eases someone
// into running with the app, building a sense of distance and a comfortable
// pace rather than chasing a 5K finish line. Shared between the server
// (scheduling + finish actions) and client (the /plan quick-schedule page and
// the coached-run finish UI), so this file must stay free of "server-only"
// imports — like gender.ts / matching.ts, it's pure data + pure functions with
// no database or cookie access.

/** Where a runner is in the plan. NULL on a user means "not enrolled". */
export type CoachStatus = "active" | "graduated";

/** How a planned run felt, collected at the end to pick the next session. */
export type CoachDifficulty = "easy" | "right" | "tough";

/** Buttons shown on the planned-run finish step, in display order. */
export const DIFFICULTY_OPTIONS: ReadonlyArray<{
  value: CoachDifficulty;
  label: string;
  hint: string;
}> = [
  { value: "easy", label: "Too easy", hint: "I could have kept going" },
  { value: "right", label: "Just right", hint: "Challenging but doable" },
  { value: "tough", label: "Too tough", hint: "I had to stop a lot" },
];

/** One planned run. Distance is the target shown on the run card. */
export type CoachSession = {
  /** Target distance in kilometres (copied onto the scheduled run). */
  distanceKm: number;
  /** Short heading, e.g. "Run 3 · Settle in". */
  title: string;
  /** What to actually do on the run — stored as the run's description. */
  description: string;
  /**
   * Longest continuous jog in this session, in minutes (the final session's is
   * the whole run). The ramp guard uses it so "too easy" never skips a runner
   * onto a session that more than doubles their longest jog — see planOutcome.
   */
  jogRepMinutes: number;
  /** Comfortable pace estimate in seconds/km; only the final session sets it. */
  targetPaceSeconds?: number;
};

// A gentle on-ramp into the app: three short runs that grow the distance a
// little each time and let a newcomer find an easy, conversational pace. It's
// about getting a feel for pace and distance — and for how the app schedules
// runs and matches partners — not a strict fitness program. The last session
// carries the comfortable pace we hand to normal matching once they're a
// regular runner.
export const COACH_PLAN: ReadonlyArray<CoachSession> = [
  {
    distanceKm: 1,
    title: "Run 1 · Find your pace",
    description:
      "Cover about 1 km nice and easy — walk to warm up, then jog in short, gentle bursts whenever you feel like it. The aim isn't speed, it's finding a pace you could chat at. That easy, conversational pace is what we'll match you on.",
    jogRepMinutes: 3,
  },
  {
    distanceKm: 2,
    title: "Run 2 · Get a feel for distance",
    description:
      "A bit further today, about 2 km. Mix easy jogging with walking and notice how the distance feels at a relaxed pace. You're building a sense of what a couple of kilometres takes.",
    jogRepMinutes: 8,
  },
  {
    distanceKm: 3,
    title: "Run 3 · You've got this",
    description:
      "Run about 3 km at an easy, steady pace, walking only if you really need to. This sets the comfortable pace we'll use to match you with partners — from here you're a regular runner.",
    jogRepMinutes: 20,
    targetPaceSeconds: 7 * 60 + 30, // 7:30/km
  },
];

export const COACH_PLAN_LENGTH = COACH_PLAN.length;

const LAST_SESSION = COACH_PLAN_LENGTH - 1;

/** Default comfortable pace if the final session somehow lacks one (7:30/km). */
const FALLBACK_PACE_SECONDS = 7 * 60 + 30;

/**
 * Whether a "too easy" runner can safely skip the next session and jump two
 * ahead, or should only advance one. Skipping is allowed only when the session
 * two ahead doesn't more than double the runner's current longest jog — so a
 * beginner is never fast-forwarded onto a jump their legs aren't ready for. With
 * the current gentle ramp this is rarely true (each session already grows fast),
 * but the guard keeps "too easy" safe if intermediate sessions are ever added.
 */
function canSkipAhead(current: number): boolean {
  const target = current + 2;
  if (target > LAST_SESSION) return false; // no whole session to skip over.
  const here = COACH_PLAN[current]?.jogRepMinutes ?? 0;
  const there = COACH_PLAN[target]?.jogRepMinutes ?? Infinity;
  return there <= here * 2;
}

/**
 * Decides what happens after a planned run, given how it felt. "Too easy"
 * advances two sessions when that's safe (see canSkipAhead) and one otherwise;
 * "just right" advances one; "too tough" repeats the same session so it can
 * click before moving on. The runner must always complete the final session
 * before graduating, so the advance is clamped to the last session and
 * graduation only happens from there.
 */
export function planOutcome(
  currentIndex: number,
  difficulty: CoachDifficulty,
): { graduated: boolean; nextIndex: number } {
  // Clamp a stored index defensively in case the plan shrinks between releases.
  const current = Math.max(0, Math.min(currentIndex, LAST_SESSION));

  if (current >= LAST_SESSION) {
    // On the final run, anything but "too tough" graduates them to a regular runner.
    if (difficulty === "tough") return { graduated: false, nextIndex: LAST_SESSION };
    return { graduated: true, nextIndex: LAST_SESSION };
  }

  const step =
    difficulty === "easy" ? (canSkipAhead(current) ? 2 : 1)
    : difficulty === "right" ? 1
    : 0;
  return { graduated: false, nextIndex: Math.min(current + step, LAST_SESSION) };
}

/**
 * The comfortable pace (seconds/km) we estimate for someone finishing the plan,
 * handed to normal partner matching. Taken from the final session's target pace.
 */
export function estimateFiveKPaceSeconds(): number {
  return COACH_PLAN[LAST_SESSION]?.targetPaceSeconds ?? FALLBACK_PACE_SECONDS;
}
