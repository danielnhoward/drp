import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/geocoding", () => ({
  reverseGeocode: vi.fn().mockResolvedValue("Mocked Location"),
}));

import { createAvailabilityFor } from "@/lib/availability";
import {
  backfillRunsForUnscheduledAvailability,
  getRunsWithin24Hours,
  scheduleRunForAvailability,
} from "@/lib/runs";
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

function participants(runId: number): number[] {
  return (
    getDb()
      .prepare("SELECT user_id FROM run_participants WHERE run_id = ? ORDER BY position")
      .all(runId) as { user_id: number }[]
  ).map((p) => p.user_id);
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

describe("scheduleRunForAvailability", () => {
  test("creates one run from the host's slot with the host plus 2 random partners", async () => {
    const host = createUser(makeFakeUser());
    createUser(makeFakeUser());
    createUser(makeFakeUser());
    createUser(makeFakeUser());
    const slot = makeFakeAvailability({
      date: TODAY,
      startTime: "10:00",
      endTime: "13:00",
      distanceKm: 5,
      lat: 51.5,
      lon: -0.1,
    });
    const availabilityId = createAvailabilityFor(host.id, slot);

    await scheduleRunForAvailability(availabilityId, host.id, slot);

    const runs = getDb()
      .prepare(
        "SELECT id, date, time, distance_km, meet_at, lat, lon, availability_id FROM runs",
      )
      .all() as {
      id: number;
      date: string;
      time: string;
      distance_km: number;
      meet_at: string;
      lat: number;
      lon: number;
      availability_id: number;
    }[];
    expect(runs).toHaveLength(1);
    const run = runs[0];
    // Every parameter comes straight from the host's slot.
    expect(run.date).toBe(TODAY);
    expect(run.time).toBe("11:30"); // midpoint of 10:00–13:00
    expect(run.distance_km).toBe(5);
    expect(run.lat).toBe(51.5);
    expect(run.lon).toBe(-0.1);
    expect(run.meet_at).toBe("Mocked Location");
    expect(run.availability_id).toBe(availabilityId);

    // Host is first, then two distinct partners — three people in total.
    const ids = participants(run.id);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBe(host.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).not.toContain(undefined);
  });

  test("creates a 2-person run when only one other user exists", async () => {
    const host = createUser(makeFakeUser());
    const partner = createUser(makeFakeUser());
    const slot = makeFakeAvailability({ date: TODAY });
    const availabilityId = createAvailabilityFor(host.id, slot);

    await scheduleRunForAvailability(availabilityId, host.id, slot);

    expect(runCount()).toBe(1);
    const runId = (getDb().prepare("SELECT id FROM runs").get() as { id: number }).id;
    expect(participants(runId).sort((a, b) => a - b)).toEqual(
      [host.id, partner.id].sort((a, b) => a - b),
    );
  });

  test("creates no run when there are no other users", async () => {
    const host = createUser(makeFakeUser());
    const slot = makeFakeAvailability({ date: TODAY });
    const availabilityId = createAvailabilityFor(host.id, slot);

    await scheduleRunForAvailability(availabilityId, host.id, slot);

    expect(runCount()).toBe(0);
  });

  test("ignores the partners' own availability when picking them", async () => {
    // The partner has no availability at all, yet still gets pulled into the run.
    const host = createUser(makeFakeUser());
    const partner = createUser(makeFakeUser());
    const slot = makeFakeAvailability({ date: TODAY });
    const availabilityId = createAvailabilityFor(host.id, slot);

    await scheduleRunForAvailability(availabilityId, host.id, slot);

    const runId = (getDb().prepare("SELECT id FROM runs").get() as { id: number }).id;
    expect(participants(runId)).toContain(partner.id);
  });
});

describe("availability deletion cascade", () => {
  test("deleting a slot removes only its run, leaving other runs intact", async () => {
    const host = createUser(makeFakeUser());
    createUser(makeFakeUser());

    const slotA = makeFakeAvailability({ date: TODAY, startTime: "10:00", endTime: "12:00" });
    const slotB = makeFakeAvailability({ date: TOMORROW, startTime: "06:00", endTime: "08:00" });
    const idA = createAvailabilityFor(host.id, slotA);
    const idB = createAvailabilityFor(host.id, slotB);
    await scheduleRunForAvailability(idA, host.id, slotA);
    await scheduleRunForAvailability(idB, host.id, slotB);
    expect(runCount()).toBe(2);

    // Deleting slot A removes its run via the availability_id ON DELETE CASCADE.
    getDb().prepare("DELETE FROM availability WHERE id = ?").run(idA);

    const remaining = getDb()
      .prepare("SELECT availability_id FROM runs")
      .all() as { availability_id: number }[];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].availability_id).toBe(idB);
    // The orphaned run's participants cascade away too.
    expect(
      (getDb().prepare("SELECT COUNT(*) AS c FROM run_participants").get() as { c: number }).c,
    ).toBeGreaterThan(0);
  });
});

describe("backfillRunsForUnscheduledAvailability", () => {
  test("schedules a run for each slot that doesn't have one, and is idempotent", async () => {
    const alice = createUser(makeFakeUser());
    const bob = createUser(makeFakeUser());
    // Slots created without scheduling a run (e.g. the dev seed path).
    createAvailabilityFor(alice.id, makeFakeAvailability({ date: TODAY }));
    createAvailabilityFor(bob.id, makeFakeAvailability({ date: TOMORROW }));
    expect(runCount()).toBe(0);

    await backfillRunsForUnscheduledAvailability();
    expect(runCount()).toBe(2);

    // Re-running skips slots that already have a run — no duplicates.
    await backfillRunsForUnscheduledAvailability();
    expect(runCount()).toBe(2);
  });

  test("leaves a lone user's slot without a run", async () => {
    const loner = createUser(makeFakeUser());
    createAvailabilityFor(loner.id, makeFakeAvailability({ date: TODAY }));

    await backfillRunsForUnscheduledAvailability();

    expect(runCount()).toBe(0);
  });
});

describe("getRunsWithin24Hours", () => {
  test("returns only runs starting within the next 24 hours", async () => {
    const host = createUser(makeFakeUser());
    createUser(makeFakeUser());
    const within = { startTime: "11:00", endTime: "12:00" };
    const soon = makeFakeAvailability({ date: TODAY, ...within });
    const later = makeFakeAvailability({ date: IN_TWO_DAYS, ...within });
    const soonId = createAvailabilityFor(host.id, soon);
    const laterId = createAvailabilityFor(host.id, later);
    await scheduleRunForAvailability(soonId, host.id, soon);
    await scheduleRunForAvailability(laterId, host.id, later);

    const runs = getRunsWithin24Hours(host.id);
    expect(runs).toHaveLength(1);
    expect(runs[0].date).toBe(TODAY);
    expect(runs[0].time).toBe("11:30");
    // Partners excludes the viewer themselves.
    expect(runs[0].partners).toHaveLength(1);
  });

  test("returns every run within 24 hours, ordered by start time", async () => {
    const host = createUser(makeFakeUser());
    createUser(makeFakeUser());
    // Later today (11:30) and early tomorrow (07:00) — the window straddles two
    // calendar dates, so the host is in two runs that are both < 24h out.
    const slotToday = makeFakeAvailability({ date: TODAY, startTime: "11:00", endTime: "12:00" });
    const slotTomorrow = makeFakeAvailability({ date: TOMORROW, startTime: "06:00", endTime: "08:00" });
    const todayId = createAvailabilityFor(host.id, slotToday);
    const tomorrowId = createAvailabilityFor(host.id, slotTomorrow);
    await scheduleRunForAvailability(todayId, host.id, slotToday);
    await scheduleRunForAvailability(tomorrowId, host.id, slotTomorrow);

    const runs = getRunsWithin24Hours(host.id);
    expect(runs.map((r) => `${r.date} ${r.time}`)).toEqual([
      `${TODAY} 11:30`,
      `${TOMORROW} 07:00`,
    ]);
  });

  test("returns nothing when the user has no upcoming runs", async () => {
    const loner = createUser(makeFakeUser());
    const slot = makeFakeAvailability({ date: TODAY, startTime: "11:00", endTime: "12:00" });
    const id = createAvailabilityFor(loner.id, slot);
    // No other users → no run is created.
    await scheduleRunForAvailability(id, loner.id, slot);

    expect(getRunsWithin24Hours(loner.id)).toEqual([]);
  });
});
