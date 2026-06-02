import "server-only";

import { getDb } from "./db";
import { isoDateInDays } from "./format-date";

export type Runner = {
  /** The user's id. */
  id: number;
  /** Display name, from the users table. */
  name: string;
  /** URL of the user's profile picture, or null if they have none. */
  avatar: string | null;
  /** ISO date of birth (yyyy-mm-dd); age is derived for display. */
  dateOfBirth: string;
  /** One of the values in GENDERS (lib/gender.ts). */
  gender: string;
  /** Comfortable pace in seconds per kilometre. */
  preferredPaceSeconds: number;
  /** Optional free text: why they enjoy running with others, or null. */
  whyRun: string | null;
  /** Optional free text: recent non-running hobbies, or null. */
  hobbies: string | null;
  /** Optional free text: other interests / conversation starters, or null. */
  interests: string | null;
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
  /** URL of the run's group photo, or null until one is uploaded. */
  photo: string | null;
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
  photo: string | null;
};

// Returns everyone in the run *except* the current user — the home page header
// is "Next run:" and the partners list reads "Running with:", so showing the
// viewer's own name there would be redundant.
function partnersForRun(runId: number, currentUserId: number): Runner[] {
  const rows = getDb()
    .prepare(
      `SELECT users.id AS id,
              users.name AS name,
              users.avatar AS avatar,
              users.date_of_birth AS dateOfBirth,
              users.gender AS gender,
              users.preferred_pace_seconds AS preferredPaceSeconds,
              users.why_run AS whyRun,
              users.hobbies AS hobbies,
              users.interests AS interests
       FROM run_participants
       JOIN users ON users.id = run_participants.user_id
       WHERE run_participants.run_id = ? AND run_participants.user_id != ?
       ORDER BY run_participants.position ASC`,
    )
    .all(runId, currentUserId) as Runner[];
  // node:sqlite rows have a null prototype, which can't cross the
  // Server→Client Component boundary — copy each into a plain object.
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    dateOfBirth: row.dateOfBirth,
    gender: row.gender,
    preferredPaceSeconds: row.preferredPaceSeconds,
    whyRun: row.whyRun,
    hobbies: row.hobbies,
    interests: row.interests,
  }));
}

/** Returns the next upcoming run the given user is part of, or null. */
export function getNextRun(userId: number): Run | null {
  const row = getDb()
    .prepare(
      `SELECT runs.id, runs.date, runs.time, runs.distance_km, runs.meet_at, runs.lat, runs.lon, runs.photo
       FROM runs
       JOIN run_participants ON run_participants.run_id = runs.id
       WHERE run_participants.user_id = ?
         AND (run_participants.visible IS NULL OR run_participants.visible = 1)
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
    photo: row.photo,
    partners: partnersForRun(row.id, userId),
  };
}

/** Stores (or clears, with null) the URL of a run's group photo. */
export function updateRunPhoto(runId: number, photo: string | null): void {
  getDb().prepare(`UPDATE runs SET photo = ? WHERE id = ?`).run(photo, runId);
}

export async function finishRun(runId: number, userId: number): Promise<void> {
  getDb()
    .prepare(`UPDATE run_participants SET visible = 0 WHERE run_id = ? AND user_id = ?`)
    .run(runId, userId);
}
