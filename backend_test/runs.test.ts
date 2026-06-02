import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createAvailabilityFor } from "@/lib/availability";
import { getRunsWithin24Hours, recomputeRuns } from "@/lib/runs";
import { createUser } from "@/lib/users";

import { getDb, makeFakeAvailability, makeFakeUser } from "./harness";

// Anchor "now" at 08:00 local on a reference day so the 24-hour window is
// deterministic regardless of when the suite runs. getRunsWithin24Hours parses
// run start times in local time, so anchoring "now" in local time keeps the
// comparison consistent. Run windows below are chosen relative to this.
const NOW = new Date("2026-06-10T08:00:00");
const TODAY = "2026-06-10"; // run at 11:30 → +3.5h, inside the window
const TOMORROW = "2026-06-11"; // run at 07:00 → +23h, still inside the window
const IN_TWO_DAYS = "2026-06-12"; // any time → outside the window

function runCount(): number {
  return (getDb().prepare("SELECT COUNT(*) AS c FROM runs").get() as { c: number }).c;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  // Each test starts from an empty database (the temp DB is shared per file).
  getDb().exec(
    "DELETE FROM run_participants; DELETE FROM runs; DELETE FROM availability; DELETE FROM users;",
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("recomputeRuns", () => {
  test("creates a run and its participants for matching users", () => {
    const alice = createUser(makeFakeUser());
    const bob = createUser(makeFakeUser());
    const slot = { date: TODAY, startTime: "11:00", endTime: "12:00" };
    createAvailabilityFor(alice.id, makeFakeAvailability(slot));
    createAvailabilityFor(bob.id, makeFakeAvailability(slot));

    recomputeRuns();

    const runs = getDb()
      .prepare("SELECT id, date, time FROM runs")
      .all() as { id: number; date: string; time: string }[];
    expect(runs).toHaveLength(1);
    expect(runs[0].date).toBe(TODAY);
    expect(runs[0].time).toBe("11:30");

    const participants = getDb()
      .prepare("SELECT user_id FROM run_participants WHERE run_id = ? ORDER BY position")
      .all(runs[0].id) as { user_id: number }[];
    expect(participants.map((p) => p.user_id).sort((a, b) => a - b)).toEqual(
      [alice.id, bob.id].sort((a, b) => a - b),
    );
  });

  test("leaves a lone runner unmatched, and re-matches when a partner appears", () => {
    const alice = createUser(makeFakeUser());
    const bob = createUser(makeFakeUser());
    const slot = { date: TODAY, startTime: "11:00", endTime: "12:00" };

    createAvailabilityFor(alice.id, makeFakeAvailability(slot));
    recomputeRuns();
    expect(runCount()).toBe(0); // alone → no run

    createAvailabilityFor(bob.id, makeFakeAvailability(slot));
    recomputeRuns();
    expect(runCount()).toBe(1); // now paired

    // Removing the partner dissolves the run on the next recompute (idempotent).
    getDb().prepare("DELETE FROM availability WHERE user_id = ?").run(bob.id);
    recomputeRuns();
    expect(runCount()).toBe(0);
  });

  test("recompute does not accumulate duplicate runs", () => {
    const alice = createUser(makeFakeUser());
    const bob = createUser(makeFakeUser());
    const slot = { date: TODAY, startTime: "11:00", endTime: "12:00" };
    createAvailabilityFor(alice.id, makeFakeAvailability(slot));
    createAvailabilityFor(bob.id, makeFakeAvailability(slot));

    recomputeRuns();
    recomputeRuns();
    recomputeRuns();

    expect(runCount()).toBe(1);
  });

  test("a user with two overlapping same-date slots doesn't break recompute", () => {
    const alice = createUser(makeFakeUser());
    const bob = createUser(makeFakeUser());
    const slot = { date: TODAY, startTime: "11:00", endTime: "12:00" };
    // Alice has two overlapping slots that day (e.g. the dev SEED slot plus one
    // she added) — these must not group her with herself.
    createAvailabilityFor(alice.id, makeFakeAvailability(slot));
    createAvailabilityFor(alice.id, makeFakeAvailability({ ...slot, startTime: "11:15" }));
    createAvailabilityFor(bob.id, makeFakeAvailability(slot));

    expect(() => recomputeRuns()).not.toThrow();

    // One run, with Alice and Bob each appearing exactly once.
    expect(runCount()).toBe(1);
    const parts = getDb()
      .prepare("SELECT user_id FROM run_participants")
      .all() as { user_id: number }[];
    expect(parts.filter((p) => p.user_id === alice.id)).toHaveLength(1);
    expect(parts.filter((p) => p.user_id === bob.id)).toHaveLength(1);
  });
});

describe("getRunsWithin24Hours", () => {
  test("returns only runs starting within the next 24 hours", () => {
    const alice = createUser(makeFakeUser());
    const bob = createUser(makeFakeUser());
    const within = { startTime: "11:00", endTime: "12:00" };
    createAvailabilityFor(alice.id, makeFakeAvailability({ date: TODAY, ...within }));
    createAvailabilityFor(bob.id, makeFakeAvailability({ date: TODAY, ...within }));
    createAvailabilityFor(alice.id, makeFakeAvailability({ date: IN_TWO_DAYS, ...within }));
    createAvailabilityFor(bob.id, makeFakeAvailability({ date: IN_TWO_DAYS, ...within }));

    recomputeRuns();

    const runs = getRunsWithin24Hours(alice.id);
    expect(runs).toHaveLength(1);
    expect(runs[0].date).toBe(TODAY);
    expect(runs[0].time).toBe("11:30");
    // Partners excludes the viewer themselves.
    expect(runs[0].partners).toHaveLength(1);
  });

  test("returns every run within 24 hours, ordered by start time", () => {
    const alice = createUser(makeFakeUser());
    const bob = createUser(makeFakeUser());
    // Later today (11:30) and early tomorrow (07:00) — the window straddles two
    // calendar dates, so the same runner is in two runs that are both < 24h out.
    createAvailabilityFor(alice.id, makeFakeAvailability({ date: TODAY, startTime: "11:00", endTime: "12:00" }));
    createAvailabilityFor(bob.id, makeFakeAvailability({ date: TODAY, startTime: "11:00", endTime: "12:00" }));
    createAvailabilityFor(alice.id, makeFakeAvailability({ date: TOMORROW, startTime: "06:00", endTime: "08:00" }));
    createAvailabilityFor(bob.id, makeFakeAvailability({ date: TOMORROW, startTime: "06:00", endTime: "08:00" }));

    recomputeRuns();

    const runs = getRunsWithin24Hours(alice.id);
    expect(runs.map((r) => `${r.date} ${r.time}`)).toEqual([
      `${TODAY} 11:30`,
      `${TOMORROW} 07:00`,
    ]);
  });

  test("returns nothing when the user has no upcoming runs", () => {
    const loner = createUser(makeFakeUser());
    createAvailabilityFor(
      loner.id,
      makeFakeAvailability({ date: TODAY, startTime: "11:00", endTime: "12:00" }),
    );
    recomputeRuns();

    expect(getRunsWithin24Hours(loner.id)).toEqual([]);
  });
});
