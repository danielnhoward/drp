import "server-only";

import { getDb } from "./db";
import { isoDateInDays } from "./format-date";

export type Runner = {
  /** The user's id, used to link to their runner profile. */
  id: number;
  /** Display name, from the users table. */
  name: string;
  /** URL of the user's profile picture, or null if they have none. */
  avatar: string | null;
};

export type Run = {
  id: number;
  /** ISO date (yyyy-mm-dd) of the run. Always populated: falls back to a dummy
   *  date while the matching system that sets real dates isn't built yet. */
  date: string;
  /** Start time, e.g. "10:00". */
  time: string;
  /** Distance in kilometres. */
  distanceKm: number;
  /** Meeting point address, e.g. "123 East Road". */
  meetAt: string;
  /** The other people you're running with. */
  partners: Runner[];
  /** Map centre used to render the embedded map. */
  lat: number;
  lon: number;
};

// Row shapes as returned by SQLite (snake_case columns).
type RunRow = {
  id: number;
  date: string | null;
  time: string;
  distance_km: number;
  meet_at: string;
  lat: number;
  lon: number;
};

// Returns everyone in the run *except* the current user — the home page header
// is "Next run:" and the partners list reads "Running with:", so showing the
// viewer's own name there would be redundant.
function partnersForRun(runId: number, currentUserId: number): Runner[] {
  return getDb()
    .prepare(
      `SELECT users.id AS id, users.name AS name, users.avatar AS avatar
       FROM run_participants
       JOIN users ON users.id = run_participants.user_id
       WHERE run_participants.run_id = ? AND run_participants.user_id != ?
       ORDER BY run_participants.position ASC`,
    )
    .all(runId, currentUserId) as Runner[];
}

/** Returns the next upcoming run the given user is part of, or null. */
export function getNextRun(userId: number): Run | null {
  const row = getDb()
    .prepare(
      `SELECT runs.id, runs.date, runs.time, runs.distance_km, runs.meet_at, runs.lat, runs.lon
       FROM runs
       JOIN run_participants ON run_participants.run_id = runs.id
       WHERE run_participants.user_id = ?
       ORDER BY runs.date IS NULL, runs.date ASC, runs.time ASC, runs.id ASC
       LIMIT 1`,
    )
    .get(userId) as RunRow | undefined;
  if (!row) return null;

  return {
    id: row.id,
    // Dummy fallback until the matching system stores a real date on the run.
    date: row.date ?? isoDateInDays(3),
    time: row.time,
    distanceKm: row.distance_km,
    meetAt: row.meet_at,
    lat: row.lat,
    lon: row.lon,
    partners: partnersForRun(row.id, userId),
  };
}
