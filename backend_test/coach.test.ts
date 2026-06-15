import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/geocoding", () => ({
  reverseGeocode: vi.fn().mockResolvedValue("Mocked Location"),
}));

import {
  COACH_PLAN,
  COACH_PLAN_LENGTH,
  estimateFiveKPaceSeconds,
  planOutcome,
  skipPlanSession,
} from "@/lib/coach";
import {
  cancelPendingCoachedRunForUser,
  cancelPendingCoachedRunsForUser,
  getCoachedRunSession,
  getPendingCoachedRun,
  getRunsWithin24Hours,
  scheduleCoachedRun,
} from "@/lib/runs";
import {
  createUser,
  enrollUserInCoaching,
  graduateUser,
  leaveUserCoaching,
  setCoachSessionIndex,
} from "@/lib/users";

import { getDb, makeFakeUser } from "./harness";

const LAST = COACH_PLAN_LENGTH - 1;

// Anchor "now" so a run scheduled for TODAY 11:00–12:00 (midpoint 11:30) is
// inside the 24-hour window, matching runs.test.ts.
const NOW = new Date("2026-06-10T08:00:00");
const TODAY = "2026-06-10";

function runCount(): number {
  return (getDb().prepare("SELECT COUNT(*) AS c FROM runs").get() as { c: number }).c;
}

function participants(runId: number): number[] {
  return (
    getDb()
      .prepare("SELECT user_id FROM run_participants WHERE run_id = ? ORDER BY position")
      .all(runId) as { user_id: number }[]
  ).map((p) => p.user_id);
}

function participantCount(): number {
  return (
    getDb().prepare("SELECT COUNT(*) AS c FROM run_participants").get() as {
      c: number;
    }
  ).c;
}

function userRow(id: number) {
  return getDb()
    .prepare(
      "SELECT coach_status, coach_session_index, preferred_pace_seconds FROM users WHERE id = ?",
    )
    .get(id) as {
    coach_status: string | null;
    coach_session_index: number | null;
    preferred_pace_seconds: number | null;
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  getDb().exec(
    "DELETE FROM run_participants; DELETE FROM runs; DELETE FROM availability; DELETE FROM users;",
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("planOutcome", () => {
  test("advances by one on 'just right' and repeats on 'too tough'", () => {
    expect(planOutcome(0, "right")).toEqual({ graduated: false, nextIndex: 1 });
    expect(planOutcome(0, "tough")).toEqual({ graduated: false, nextIndex: 0 });
  });

  test("'too easy' only advances one when skipping ahead would more than double the jog", () => {
    // The ramp grows fast (3→8→20 min jogs), so skipping session 1 would land on
    // a 20-min jog vs the current 3-min — more than double — and is held to +1.
    expect(planOutcome(0, "easy")).toEqual({ graduated: false, nextIndex: 1 });
  });

  test("never skips past the final session before graduating", () => {
    // "Too easy" on the penultimate run lands on the final run, not past it.
    expect(planOutcome(LAST - 1, "easy")).toEqual({
      graduated: false,
      nextIndex: LAST,
    });
  });

  test("graduates from the final session unless it was too tough", () => {
    expect(planOutcome(LAST, "right")).toEqual({ graduated: true, nextIndex: LAST });
    expect(planOutcome(LAST, "easy")).toEqual({ graduated: true, nextIndex: LAST });
    // A brutal final run repeats rather than graduating.
    expect(planOutcome(LAST, "tough")).toEqual({ graduated: false, nextIndex: LAST });
  });

  test("clamps an out-of-range stored index", () => {
    expect(planOutcome(999, "right").nextIndex).toBe(LAST);
    expect(planOutcome(-5, "tough").nextIndex).toBe(0);
  });
});

describe("planner skip + exit", () => {
  test("skipPlanSession advances one session, and exits on the final session", () => {
    expect(skipPlanSession(0)).toEqual({ graduated: false, nextIndex: 1 });
    expect(skipPlanSession(LAST - 1)).toEqual({
      graduated: false,
      nextIndex: LAST,
    });
    expect(skipPlanSession(LAST)).toEqual({
      graduated: true,
      nextIndex: LAST,
    });
  });

  test("skipping a booked planner run advances one session and removes the booking", async () => {
    const host = createUser(makeFakeUser());
    enrollUserInCoaching(host.id);
    await scheduleCoachedRun(
      host.id,
      { date: TODAY, startTime: "10:00", endTime: "12:00", lat: 51.5, lon: -0.1 },
      0,
    );
    const runId = (getDb().prepare("SELECT id FROM runs").get() as { id: number }).id;

    const skippedSession = cancelPendingCoachedRunForUser(runId, host.id);
    expect(skippedSession).toBe(0);
    const outcome = skipPlanSession(skippedSession ?? 0);
    expect(outcome).toEqual({ graduated: false, nextIndex: 1 });
    setCoachSessionIndex(host.id, outcome.nextIndex);

    const row = userRow(host.id);
    expect(row.coach_status).toBe("active");
    expect(row.coach_session_index).toBe(1);
    expect(runCount()).toBe(0);
    expect(participantCount()).toBe(0);
    expect(getPendingCoachedRun(host.id)).toBeNull();
    expect(getRunsWithin24Hours(host.id)).toEqual([]);
  });

  test("skipping the final planner run exits the guided flow", async () => {
    const host = createUser(makeFakeUser());
    enrollUserInCoaching(host.id);
    setCoachSessionIndex(host.id, LAST);
    await scheduleCoachedRun(
      host.id,
      { date: TODAY, startTime: "10:00", endTime: "12:00", lat: 51.5, lon: -0.1 },
      LAST,
    );
    const runId = (getDb().prepare("SELECT id FROM runs").get() as { id: number }).id;

    const skippedSession = cancelPendingCoachedRunForUser(runId, host.id);
    expect(skippedSession).toBe(LAST);
    const outcome = skipPlanSession(skippedSession ?? 0);
    expect(outcome.graduated).toBe(true);
    leaveUserCoaching(host.id);

    const row = userRow(host.id);
    expect(row.coach_status).toBeNull();
    expect(row.coach_session_index).toBeNull();
    expect(runCount()).toBe(0);
    expect(getPendingCoachedRun(host.id)).toBeNull();
  });

  test("planner cancellation only deletes runs owned by that runner", async () => {
    const host = createUser(makeFakeUser());
    const partner = createUser(makeFakeUser());
    enrollUserInCoaching(host.id);
    enrollUserInCoaching(partner.id);
    await scheduleCoachedRun(
      host.id,
      { date: TODAY, startTime: "10:00", endTime: "12:00", lat: 51.5, lon: -0.1 },
      0,
    );
    const runId = (getDb().prepare("SELECT id FROM runs").get() as { id: number }).id;

    expect(cancelPendingCoachedRunForUser(runId, partner.id)).toBeNull();
    expect(runCount()).toBe(1);
    expect(getPendingCoachedRun(partner.id)).toBeNull();
    expect(getPendingCoachedRun(host.id)?.id).toBe(runId);
  });

  test("leaving planner cancels owned pending runs and unlocks normal scheduling", async () => {
    const host = createUser(makeFakeUser());
    enrollUserInCoaching(host.id);
    await scheduleCoachedRun(
      host.id,
      { date: TODAY, startTime: "10:00", endTime: "12:00", lat: 51.5, lon: -0.1 },
      0,
    );
    await scheduleCoachedRun(
      host.id,
      { date: "2026-06-12", startTime: "10:00", endTime: "12:00", lat: 51.5, lon: -0.1 },
      1,
    );

    expect(cancelPendingCoachedRunsForUser(host.id)).toBe(2);
    leaveUserCoaching(host.id);

    const row = userRow(host.id);
    expect(row.coach_status).toBeNull();
    expect(row.coach_session_index).toBeNull();
    expect(runCount()).toBe(0);
    expect(participantCount()).toBe(0);
  });
});

describe("scheduleCoachedRun", () => {
  test("creates a run carrying the plan's distance + description, even with no other users", async () => {
    const host = createUser(makeFakeUser());
    enrollUserInCoaching(host.id);

    await scheduleCoachedRun(
      host.id,
      { date: TODAY, startTime: "10:00", endTime: "13:00", lat: 51.5, lon: -0.1 },
      0,
    );

    expect(runCount()).toBe(1);
    const run = getDb()
      .prepare(
        "SELECT id, time, distance_km, description, coach_session_index, availability_id FROM runs",
      )
      .get() as {
      id: number;
      time: string;
      distance_km: number;
      description: string;
      coach_session_index: number;
      availability_id: number | null;
    };
    expect(run.time).toBe("11:30"); // midpoint of 10:00–13:00
    expect(run.distance_km).toBe(COACH_PLAN[0].distanceKm);
    expect(run.description).toBe(COACH_PLAN[0].description);
    expect(run.coach_session_index).toBe(0);
    // Coached runs aren't tied to an availability slot.
    expect(run.availability_id).toBeNull();
    // Solo is fine — only the host is a participant.
    expect(participants(run.id)).toEqual([host.id]);
  });

  test("attaches up to two other users as mock beginner partners", async () => {
    const host = createUser(makeFakeUser());
    createUser(makeFakeUser());
    createUser(makeFakeUser());
    createUser(makeFakeUser());

    await scheduleCoachedRun(
      host.id,
      { date: TODAY, startTime: "10:00", endTime: "12:00", lat: 51.5, lon: -0.1 },
      2,
    );

    const runId = (getDb().prepare("SELECT id FROM runs").get() as { id: number }).id;
    const ids = participants(runId);
    expect(ids).toHaveLength(3); // host + 2 partners
    expect(ids[0]).toBe(host.id);
    expect(new Set(ids).size).toBe(3);
  });

  test("surfaces as a coached run via getRunsWithin24Hours", async () => {
    const host = createUser(makeFakeUser());
    enrollUserInCoaching(host.id);
    await scheduleCoachedRun(
      host.id,
      { date: TODAY, startTime: "11:00", endTime: "12:00", lat: 51.5, lon: -0.1 },
      1,
    );

    const runs = getRunsWithin24Hours(host.id);
    expect(runs).toHaveLength(1);
    expect(runs[0].coachSessionIndex).toBe(1);
    expect(runs[0].description).toBe(COACH_PLAN[1].description);
  });
});

describe("coach run queries", () => {
  test("getCoachedRunSession returns the session for a coached run and null otherwise", async () => {
    const host = createUser(makeFakeUser());
    await scheduleCoachedRun(
      host.id,
      { date: TODAY, startTime: "10:00", endTime: "12:00", lat: 51.5, lon: -0.1 },
      2,
    );
    const runId = (getDb().prepare("SELECT id FROM runs").get() as { id: number }).id;
    expect(getCoachedRunSession(runId)).toBe(2);
    expect(getCoachedRunSession(999999)).toBeNull();
  });

  test("getPendingCoachedRun returns the unfinished run, then null once finished", async () => {
    const host = createUser(makeFakeUser());
    enrollUserInCoaching(host.id);
    await scheduleCoachedRun(
      host.id,
      { date: TODAY, startTime: "10:00", endTime: "12:00", lat: 51.5, lon: -0.1 },
      0,
    );

    const pending = getPendingCoachedRun(host.id);
    expect(pending?.coachSessionIndex).toBe(0);

    // Mark the host finished (visible = 0) → no longer pending.
    getDb()
      .prepare("UPDATE run_participants SET visible = 0 WHERE user_id = ?")
      .run(host.id);
    expect(getPendingCoachedRun(host.id)).toBeNull();
  });
});

describe("enrolment + graduation", () => {
  test("enrollUserInCoaching activates the program at session 0", () => {
    const user = createUser(makeFakeUser());
    enrollUserInCoaching(user.id);
    const row = userRow(user.id);
    expect(row.coach_status).toBe("active");
    expect(row.coach_session_index).toBe(0);
  });

  test("setCoachSessionIndex moves the runner along the plan", () => {
    const user = createUser(makeFakeUser());
    enrollUserInCoaching(user.id);
    setCoachSessionIndex(user.id, 4);
    expect(userRow(user.id).coach_session_index).toBe(4);
  });

  test("graduateUser marks graduated and seeds an estimated pace", () => {
    const user = createUser(makeFakeUser());
    enrollUserInCoaching(user.id);
    setCoachSessionIndex(user.id, LAST);

    graduateUser(user.id);

    const row = userRow(user.id);
    expect(row.coach_status).toBe("graduated");
    expect(row.preferred_pace_seconds).toBe(estimateFiveKPaceSeconds());
  });

  test("graduateUser keeps an existing pace rather than overwriting it", () => {
    const user = createUser(makeFakeUser());
    getDb()
      .prepare("UPDATE users SET preferred_pace_seconds = ? WHERE id = ?")
      .run(300, user.id);

    graduateUser(user.id);

    expect(userRow(user.id).preferred_pace_seconds).toBe(300);
  });
});
