// Shared date helpers. No `import "server-only"` (like gender.ts) so they can be
// used from both Server and Client Components.

/**
 * Formats an ISO date string (yyyy-mm-dd) for display, e.g. "Sat, 7 Jun".
 *
 * The `T00:00:00` suffix forces the string to parse in LOCAL time. Passing a
 * bare "2026-06-07" to `new Date()` parses it as UTC midnight, which renders as
 * the previous day in negative-offset time zones.
 */
export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Whole years between an ISO date of birth (yyyy-mm-dd) and today, in local
 * time. Subtracts one from the year difference until the birthday has passed
 * this year.
 */
export function ageFromDateOfBirth(iso: string): number {
  const dob = new Date(`${iso}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

/** Today's date as an ISO string (yyyy-mm-dd), in the local time zone. */
export function isoToday(): string {
  return isoDateInDays(0);
}

/** An ISO date string (yyyy-mm-dd) `days` days from now. */
export function isoDateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
