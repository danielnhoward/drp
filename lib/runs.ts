import "server-only";

import { getDb } from "./db";
import { isoDateInDays, isoToday } from "./format-date";
import { computeRuns, type MatchableAvailability } from "./matching";
import { reverseGeocode } from "./geocoding";

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
   *  date for any legacy row predating the matching system that sets real dates. */
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

type AvailabilityMatchRow = {
  user_id: number;
  /** NULL for legacy slots created before the date column was added. */
  date: string | null;
  start_time: string;
  end_time: string;
  distance_km: number;
  pace_min_seconds: number;
  pace_max_seconds: number;
  lat: number;
  lon: number;
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

/**
 * Recomputes all runs from current availability and persists them. Called after
 * any availability change (add / edit / delete) so matches stay in sync.
 *
 * Reads every slot from today onward straight from the availability table (not
 * via lib/availability.ts, to avoid an import cycle), runs the pure matcher, and
 * replaces the runs it owns (today onward) in a single transaction.
 */
export async function recomputeRuns(): Promise<void> {
  const db = getDb();
  const today = isoToday();

  const rows = db
    .prepare(
      `SELECT user_id, date, start_time, end_time, distance_km, pace_min_seconds, pace_max_seconds, lat, lon
       FROM availability
       WHERE date >= ? OR date IS NULL`,
    )
    .all(today) as AvailabilityMatchRow[];

  const availabilities: MatchableAvailability[] = rows.map((row) => ({
    userId: row.user_id,
    // Treat legacy null-date slots as today, matching listMyAvailability's fallback.
    date: row.date ?? today,
    startTime: row.start_time,
    endTime: row.end_time,
    distanceKm: row.distance_km,
    paceMinSeconds: row.pace_min_seconds,
    paceMaxSeconds: row.pace_max_seconds,
    lat: row.lat,
    lon: row.lon,
  }));

  const proposed = computeRuns(availabilities);

  // Geocode all centroids before entering the synchronous DB transaction
  // (can't interleave await with DatabaseSync).
  const geocodedMeetAt = await Promise.all(
    proposed.map((run) => reverseGeocode(run.lat, run.lon)),
  );

  // Wipe and rebuild the runs we own (today onward) atomically, so a failure
  // can't leave half-updated matches. run_participants clears via cascade.
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM runs WHERE date >= ?").run(today);

    const insertRun = db.prepare(
      `INSERT INTO runs (date, time, distance_km, meet_at, lat, lon)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insertParticipant = db.prepare(
      "INSERT INTO run_participants (run_id, user_id, position) VALUES (?, ?, ?)",
    );

    for (let i = 0; i < proposed.length; i++) {
      const run = proposed[i];
      const { lastInsertRowid } = insertRun.run(
        run.date,
        run.time,
        run.distanceKm,
        geocodedMeetAt[i],
        run.lat,
        run.lon,
      );
      const runId = Number(lastInsertRowid);
      run.userIds.forEach((userId, position) => {
        insertParticipant.run(runId, userId, position);
      });
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Returns every run the given user is part of that starts within the next 24
 * hours, ordered by start time. A user can have more than one: the 24h window
 * can span two calendar dates, and they may be matched on each.
 */
export function getRunsWithin24Hours(userId: number): Run[] {
  const rows = getDb()
    .prepare(
      `SELECT runs.id, runs.date, runs.time, runs.distance_km, runs.meet_at, runs.lat, runs.lon, runs.photo
       FROM runs
       JOIN run_participants ON run_participants.run_id = runs.id
       WHERE run_participants.user_id = ?
         AND (run_participants.visible IS NULL OR run_participants.visible = 1)
       ORDER BY runs.date IS NULL, runs.date ASC, runs.time ASC, runs.id ASC
       LIMIT 1`,
    )
    .all(userId) as RunRow[];

  const now = Date.now();
  const horizon = now + 24 * 60 * 60 * 1000;

  // Rows arrive in chronological order, so the filtered result stays ordered.
  return rows
    .map((row) => ({
      id: row.id,
      // Dummy fallback for hypothetical legacy rows; matcher runs always set a date.
      date: row.date ?? isoDateInDays(3),
      time: row.time,
      distanceKm: row.distance_km,
      meetAt: row.meet_at,
      lat: row.lat,
      lon: row.lon,
      photo: row.photo,
      partners: partnersForRun(row.id, userId),
    }))
    .filter((run) => {
      // The "T..:..:00" suffix forces local-time parsing (see format-date.ts).
      const start = new Date(`${run.date}T${run.time}:00`).getTime();
      return start >= now && start <= horizon;
    });
}

/** Stores (or clears, with null) the URL of a run's group photo. */
export function updateRunPhoto(runId: number, photo: string | null): void {
  getDb().prepare(`UPDATE runs SET photo = ? WHERE id = ?`).run(photo, runId);
}

/** Whether the given user is one of the run's participants. */
export function isRunParticipant(runId: number, userId: number): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM run_participants WHERE run_id = ? AND user_id = ? LIMIT 1`,
    )
    .get(runId, userId);
  return row !== undefined;
}

/**
 * Marks the user as finished with the run (hiding it from their home page) and
 * reports whether they were the first participant to do so. The first finisher
 * is the one prompted to add the run's group photo.
 */
export async function finishRun(
  runId: number,
  userId: number,
): Promise<{ isFirstFinisher: boolean }> {
  const db = getDb();
  // Count *other* participants who have already finished, before marking this
  // user, so exactly one finisher is ever flagged as first.
  const { n } = db
    .prepare(
      `SELECT COUNT(*) AS n FROM run_participants
       WHERE run_id = ? AND user_id != ? AND visible = 0`,
    )
    .get(runId, userId) as { n: number };
  db.prepare(
    `UPDATE run_participants SET visible = 0 WHERE run_id = ? AND user_id = ?`,
  ).run(runId, userId);
  return { isFirstFinisher: n === 0 };
}

/**
 * Reverts a finish, putting the run back on the user's home page. Used when the
 * first finisher declines to take the group photo: they're un-finished so the
 * next participant to finish is asked for the photo instead.
 */
export async function unfinishRun(runId: number, userId: number): Promise<void> {
  getDb()
    .prepare(
      `UPDATE run_participants SET visible = 1 WHERE run_id = ? AND user_id = ?`,
    )
    .run(runId, userId);
}
