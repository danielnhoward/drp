// The Couch-to-5K coaching program for absolute beginners. Shared between the
// server (scheduling + finish actions) and client (the /coach quick-schedule
// page and the coached-run finish UI), so this file must stay free of
// "server-only" imports — like gender.ts / matching.ts, it's pure data + pure
// functions with no database or cookie access.

/** Where a runner is in the coach program. NULL on a user means "not enrolled". */
export type CoachStatus = "active" | "graduated";

/** How a coached run felt, collected at the end to pick the next session. */
export type CoachDifficulty = "easy" | "right" | "tough";

/** Buttons shown on the coached-run finish step, in display order. */
export const DIFFICULTY_OPTIONS: ReadonlyArray<{
  value: CoachDifficulty;
  label: string;
  hint: string;
}> = [
  { value: "easy", label: "Too easy", hint: "I could have kept going" },
  { value: "right", label: "Just right", hint: "Challenging but doable" },
  { value: "tough", label: "Too tough", hint: "I had to stop a lot" },
];

/** One planned training run. Distance is the target shown on the run card. */
export type CoachSession = {
  /** Target distance in kilometres (copied onto the scheduled run). */
  distanceKm: number;
  /** Short heading, e.g. "Run 3 · Longer reps". */
  title: string;
  /** What to actually do on the run — stored as the run's description. */
  description: string;
  /**
   * Longest continuous jog in this session, in minutes (the final session's is
   * the whole run). The ramp guard uses it so "too easy" never skips a runner
   * onto a session that more than doubles their longest jog — see planOutcome.
   */
  jogRepMinutes: number;
  /** Comfortable pace estimate in seconds/km; only the final 5K session sets it. */
  targetPaceSeconds?: number;
};

// A simplified distance ramp (not authentic C25K intervals): seven runs growing
// from a gentle walk-jog to a continuous 5K. The last session is the graduation
// run and carries the pace we hand to normal matching.
export const COACH_PLAN: ReadonlyArray<CoachSession> = [
  {
    distanceKm: 2,
    title: "Run 1 · Ease in",
    description:
      "Walk 5 minutes to warm up, then alternate 1 minute of easy jogging with 2 minutes of walking, eight times. Keep the jog slow enough to chat.",
    jogRepMinutes: 1,
  },
  {
    distanceKm: 2.5,
    title: "Run 2 · Find a rhythm",
    description:
      "Warm up, then jog 2 minutes / walk 1 minute, six times. Relax your shoulders and let your breathing settle.",
    jogRepMinutes: 2,
  },
  {
    distanceKm: 3,
    title: "Run 3 · Longer reps",
    description:
      "Warm up, then jog 3 minutes / walk 1 minute, five times. The walk breaks should start to feel like plenty.",
    jogRepMinutes: 3,
  },
  {
    distanceKm: 3.5,
    title: "Run 4 · Building up",
    description:
      "Warm up, then jog 5 minutes / walk 1 minute, four times. Settle into an even, comfortable effort.",
    jogRepMinutes: 5,
  },
  {
    distanceKm: 4,
    title: "Run 5 · Mostly running",
    description:
      "Warm up, then jog 8 minutes / walk 1 minute, twice, then jog gently to the finish. You're nearly continuous now.",
    jogRepMinutes: 8,
  },
  {
    distanceKm: 4.5,
    title: "Run 6 · Almost there",
    description:
      "Warm up, then jog 12 minutes / walk 1 minute / jog 12 minutes. Hold a pace you could still talk at.",
    jogRepMinutes: 12,
  },
  {
    distanceKm: 5,
    title: "Run 7 · Your first 5K",
    description:
      "Warm up, then run the full 5 km at an easy, steady pace — walk only if you really need to. This is your graduation run!",
    jogRepMinutes: 30,
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
 * Decides what happens after a coached run, given how it felt. "Too easy"
 * advances two sessions when that's safe (see canSkipAhead) and one otherwise;
 * "just right" advances one; "too tough" repeats the same session so it can
 * click before moving on. The runner must always complete the final 5K session
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
    // On the final run, anything but "too tough" graduates them.
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
 * The comfortable 5k pace (seconds/km) we estimate for a graduate, handed to
 * normal partner matching. Taken from the final session's target pace.
 */
export function estimateFiveKPaceSeconds(): number {
  return COACH_PLAN[LAST_SESSION]?.targetPaceSeconds ?? FALLBACK_PACE_SECONDS;
}
