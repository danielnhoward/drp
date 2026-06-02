import { describe, expect, test } from "vitest";

import type { NewAvailability } from "@/lib/availability";
import {
  areCompatible,
  centroid,
  computeRuns,
  formatCoords,
  haversineKm,
  isValidGroup,
  type MatchableAvailability,
  minutesToTime,
  timeToMinutes,
} from "@/lib/matching";

import { makeFakeAvailability } from "./harness";

function avail(
  userId: number,
  overrides: Partial<NewAvailability> = {},
): MatchableAvailability {
  return { userId, ...makeFakeAvailability(overrides) };
}

describe("matching helpers", () => {
  test("timeToMinutes / minutesToTime round-trip", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("10:30")).toBe(630);
    expect(timeToMinutes("13:00")).toBe(780);
    expect(minutesToTime(630)).toBe("10:30");
    expect(minutesToTime(690)).toBe("11:30");
    // Rounds to the nearest minute.
    expect(minutesToTime(689.5)).toBe("11:30");
  });

  test("haversineKm is zero for the same point and ~343 km London→Paris", () => {
    expect(haversineKm(51.5, -0.12, 51.5, -0.12)).toBe(0);
    const londonToParis = haversineKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(londonToParis).toBeGreaterThan(340);
    expect(londonToParis).toBeLessThan(346);
  });

  test("centroid averages the coordinates", () => {
    expect(centroid([{ lat: 0, lon: 0 }, { lat: 2, lon: 4 }])).toEqual({
      lat: 1,
      lon: 2,
    });
  });

  test("formatCoords renders 5 decimal places", () => {
    expect(formatCoords(51.55, -0.15)).toBe("51.55000, -0.15000");
  });

  test("areCompatible reflects date / time / pace / distance rules", () => {
    expect(areCompatible(avail(1), avail(2))).toBe(true);
    expect(areCompatible(avail(1), avail(2, { date: "2026-06-11" }))).toBe(false);
    expect(
      areCompatible(avail(1, { startTime: "08:00", endTime: "09:00" }), avail(2)),
    ).toBe(false);
    expect(
      areCompatible(
        avail(1, { paceMinSeconds: 240, paceMaxSeconds: 270 }),
        avail(2, { paceMinSeconds: 360, paceMaxSeconds: 390 }),
      ),
    ).toBe(false);
    // 7 / 5 = 1.4 > 1.2
    expect(areCompatible(avail(1, { distanceKm: 5 }), avail(2, { distanceKm: 7 }))).toBe(
      false,
    );
    // 6 / 5 = 1.2, exactly on the limit
    expect(areCompatible(avail(1, { distanceKm: 5 }), avail(2, { distanceKm: 6 }))).toBe(
      true,
    );
  });

  test("isValidGroup enforces size and shared-overlap constraints", () => {
    expect(isValidGroup([avail(1), avail(2), avail(3), avail(4)])).toBe(true);
    // Five members exceeds the cap.
    expect(
      isValidGroup([avail(1), avail(2), avail(3), avail(4), avail(5)]),
    ).toBe(false);
    // A single member is not a runnable group.
    expect(isValidGroup([avail(1)])).toBe(false);
    // The same user can't run with themselves (two of their own slots).
    expect(isValidGroup([avail(1), avail(1)])).toBe(false);
  });
});

describe("computeRuns", () => {
  test("groups two fully-overlapping users into a single run", () => {
    const runs = computeRuns([
      avail(1, { lat: 51.5, lon: -0.1 }),
      avail(2, { lat: 51.6, lon: -0.2 }),
    ]);

    expect(runs).toHaveLength(1);
    const run = runs[0];
    expect([...run.userIds].sort((a, b) => a - b)).toEqual([1, 2]);
    expect(run.date).toBe("2026-06-10");
    // Overlap window 10:00–13:00 → midpoint 11:30.
    expect(run.time).toBe("11:30");
    // Centroid of the two locations.
    expect(run.lat).toBeCloseTo(51.55, 6);
    expect(run.lon).toBeCloseTo(-0.15, 6);
    expect(run.meetAt).toBe("51.55000, -0.15000");
    // Mean of equal distances.
    expect(run.distanceKm).toBeCloseTo(5, 6);
  });

  test("start time is the midpoint of the shared overlap, not of all starts", () => {
    // Windows 10:00–12:00 and 11:00–14:00 → overlap 11:00–12:00 → midpoint 11:30.
    const runs = computeRuns([
      avail(1, { startTime: "10:00", endTime: "12:00" }),
      avail(2, { startTime: "11:00", endTime: "14:00" }),
    ]);
    expect(runs).toHaveLength(1);
    expect(runs[0].time).toBe("11:30");
  });

  test("run distance is the mean of members' distances", () => {
    const runs = computeRuns([
      avail(1, { distanceKm: 5 }),
      avail(2, { distanceKm: 6 }),
    ]);
    expect(runs).toHaveLength(1);
    expect(runs[0].distanceKm).toBeCloseTo(5.5, 6);
  });

  test("does not group users on different dates", () => {
    expect(
      computeRuns([avail(1, { date: "2026-06-10" }), avail(2, { date: "2026-06-11" })]),
    ).toEqual([]);
  });

  test("does not group users whose time windows don't overlap", () => {
    expect(
      computeRuns([
        avail(1, { startTime: "08:00", endTime: "09:00" }),
        avail(2, { startTime: "10:00", endTime: "11:00" }),
      ]),
    ).toEqual([]);
  });

  test("does not group users whose pace ranges don't overlap", () => {
    expect(
      computeRuns([
        avail(1, { paceMinSeconds: 240, paceMaxSeconds: 270 }),
        avail(2, { paceMinSeconds: 360, paceMaxSeconds: 390 }),
      ]),
    ).toEqual([]);
  });

  test("does not group users whose distances differ by more than 20%", () => {
    expect(
      computeRuns([avail(1, { distanceKm: 5 }), avail(2, { distanceKm: 7 })]),
    ).toEqual([]);
  });

  test("caps groups at 4 while still matching everyone (5 → 3 + 2)", () => {
    const runs = computeRuns([1, 2, 3, 4, 5].map((id) => avail(id)));

    const matched = runs.flatMap((r) => r.userIds).sort((a, b) => a - b);
    expect(matched).toEqual([1, 2, 3, 4, 5]); // nobody left unmatched
    const sizes = runs.map((r) => r.userIds.length);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(4);
    expect(runs.length).toBeGreaterThanOrEqual(2);
  });

  test("splits a >4 pool to minimise mean travel distance", () => {
    // Six mutually-compatible runners in two tight, far-apart clusters of three.
    // Max matched is 6; the only zero-travel way to achieve it is to keep each
    // cluster together, rather than a 4+2 split that mixes them.
    const clusterA = { lat: 51.5, lon: -0.1 };
    const clusterB = { lat: 51.6, lon: -0.2 };
    const runs = computeRuns([
      avail(1, clusterA),
      avail(2, clusterA),
      avail(3, clusterA),
      avail(4, clusterB),
      avail(5, clusterB),
      avail(6, clusterB),
    ]);

    expect(runs).toHaveLength(2);
    const groups = runs.map((r) => [...r.userIds].sort((a, b) => a - b));
    expect(groups).toContainEqual([1, 2, 3]);
    expect(groups).toContainEqual([4, 5, 6]);
  });
});

describe("computeRuns — multiple slots for one user", () => {
  test("a single user's two overlapping same-date slots produce no run", () => {
    const runs = computeRuns([
      avail(1, { startTime: "10:00", endTime: "13:00" }),
      avail(1, { startTime: "11:00", endTime: "14:00" }),
    ]);
    expect(runs).toEqual([]);
  });

  test("never places the same user in a run more than once", () => {
    // User 1 has two compatible slots; users 2 and 3 have one each.
    const runs = computeRuns([
      avail(1),
      avail(1),
      avail(2),
      avail(3),
    ]);

    const everyone = runs.flatMap((r) => r.userIds);
    // No user appears twice within a run, nor across runs.
    expect(new Set(everyone).size).toBe(everyone.length);
    // The three distinct users form one run.
    expect(runs).toHaveLength(1);
    expect([...runs[0].userIds].sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });
});
