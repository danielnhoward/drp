import "server-only";

import { getDb } from "./db";

export type Runner = {
  /** Display name, from the users table. */
  name: string;
  /** URL of the user's profile picture, or null if they have none. */
  avatar: string | null;
};

export type Run = {
  id: number;
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
      `SELECT users.name AS name, users.avatar AS avatar
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
      `SELECT runs.id, runs.time, runs.distance_km, runs.meet_at, runs.lat, runs.lon
       FROM runs
       JOIN run_participants ON run_participants.run_id = runs.id
       WHERE run_participants.user_id = ?
       ORDER BY runs.time ASC, runs.id ASC
       LIMIT 1`,
    )
    .get(userId) as RunRow | undefined;
  if (!row) return null;

  return {
    id: row.id,
    time: row.time,
    distanceKm: row.distance_km,
    meetAt: row.meet_at,
    lat: row.lat,
    lon: row.lon,
    partners: partnersForRun(row.id, userId),
  };
}
