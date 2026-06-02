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
    preferredPaceSeconds: 330, // 5:30 / km
    ...overrides,
  };
}
