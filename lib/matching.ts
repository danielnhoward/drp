// Small time helpers shared by the run scheduler. Deliberately has NO
// `import "server-only"` (like gender.ts / format-date.ts): pure functions that
// touch neither the database nor cookies, so they can be unit-tested directly
// and reused on either side of the server boundary. The scheduler that consumes
// them lives in lib/runs.ts (scheduleRunForAvailability).

/** Minutes since midnight for an "HH:MM" string. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** "HH:MM" for a minutes-since-midnight value, rounded to the nearest minute. */
export function minutesToTime(minutes: number): string {
  const total = Math.round(minutes);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
