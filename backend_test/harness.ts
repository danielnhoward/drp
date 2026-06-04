import type { NewAvailability } from "@/lib/availability";
import type { NewUser } from "@/lib/users";

// Re-exported so tests can issue a literal raw SELECT against the spun-up test
// database, in addition to going through the lib/users.ts query functions.
export { getDb } from "@/lib/db";

// Monotonic counter guaranteeing a unique email per fake user within a test
// file, so several can be inserted without colliding on the users table's
// UNIQUE (COLLATE NOCASE) email constraint.
let counter = 0;

/**
 * Builds a valid {@link NewUser} with sensible defaults. Pass `overrides` to set
 * specific fields; the email defaults to a unique address each call.
 */
export function makeFakeUser(overrides: Partial<NewUser> = {}): NewUser {
  counter += 1;
  return {
    email: `runner${counter}@example.com`,
    name: `Test Runner ${counter}`,
    dateOfBirth: "1990-01-01",
    gender: "prefer-not-to-say",
    ...overrides,
  };
}

/**
 * Builds a valid {@link NewAvailability} with defaults chosen so two slots made
 * with no overrides are mutually compatible (same date, overlapping time/pace,
 * equal distance). Override any field to set up deliberate (mis)matches. The
 * default `date` is a fixed string; DB-level tests that depend on "today" should
 * override it (e.g. via the format-date helpers under fake timers).
 */
export function makeFakeAvailability(
  overrides: Partial<NewAvailability> = {},
): NewAvailability {
  return {
    date: "2026-06-10",
    startTime: "10:00",
    endTime: "13:00",
    distanceKm: 5,
    paceMinSeconds: 4 * 60 + 30, // 4:30/km
    paceMaxSeconds: 5 * 60 + 30, // 5:30/km
    lat: 51.5073,
    lon: -0.1657,
    ...overrides,
  };
}
