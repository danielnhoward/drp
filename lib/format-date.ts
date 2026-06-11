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

/**
 * Whether a local date (yyyy-mm-dd) at an "HH:MM" time is at or before the
 * current moment — i.e. its start has already passed. Used to keep slots/runs
 * from being scheduled in the past, including an earlier-than-now time today.
 * The "T...:00" suffix forces local-time parsing (see {@link formatDate}); a
 * malformed input parses to NaN and is reported as not-past so the caller's
 * own format checks surface the real error.
 */
export function isPastDateTime(date: string, time: string): boolean {
  return new Date(`${date}T${time}:00`).getTime() <= Date.now();
}

/**
 * Whether a local date (yyyy-mm-dd) at an "HH:MM" time starts within the next
 * `hours` from now and hasn't already passed. The home page lists runs starting
 * within the next 24 hours, so the /plan booked-run card uses this to tell the
 * user whether their run is visible there yet. Malformed input is treated as
 * not-soon. The "T...:00" suffix forces local-time parsing (see {@link formatDate}).
 */
export function startsWithinHours(
  date: string,
  time: string,
  hours: number,
): boolean {
  const start = new Date(`${date}T${time}:00`).getTime();
  if (Number.isNaN(start)) return false;
  const now = Date.now();
  return start > now && start <= now + hours * 60 * 60 * 1000;
}

/** An ISO date string (yyyy-mm-dd) `days` days from now, in the local time zone. */
export function isoDateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  // Build from local date parts, not toISOString() — that returns UTC, so just
  // after local midnight in a positive-offset zone (e.g. 00:30 BST = 23:30 UTC
  // the day before) it would yield yesterday, defaulting date pickers to a past
  // day that then fails the "can't be in the past" check.
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
