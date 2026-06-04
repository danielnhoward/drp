import "server-only";

import type { NewAvailability } from "./availability";
import { getDb } from "./db";
import { isoDateInDays, isoToday } from "./format-date";
import { reverseGeocode } from "./geocoding";
import { minutesToTime, timeToMinutes } from "./matching";

/** Most partners we'll pull into a single dummy-scheduled run, besides the host. */
const MAX_PARTNERS = 2;

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
 * Schedules a single run for one availability slot, the "dummy" matcher: the run
 * takes all its parameters from the host's slot (date, the midpoint of the time
 * window, distance, and location / meeting point) and is filled with up to
 * {@link MAX_PARTNERS} *random* other users, ignoring their own availability.
 *
 * If there are no other users at all, nothing is created — a run needs at least
 * one partner. The run is linked to the slot via runs.availability_id, so
 * deleting the slot removes exactly this run (and its participants, by cascade).
 */
export async function scheduleRunForAvailability(
  availabilityId: number,
  hostUserId: number,
  slot: Pick<
    NewAvailability,
    "date" | "startTime" | "endTime" | "distanceKm" | "lat" | "lon"
  >,
): Promise<void> {
  const db = getDb();

  const partners = (
    db
      .prepare("SELECT id FROM users WHERE id != ? ORDER BY RANDOM() LIMIT ?")
      .all(hostUserId, MAX_PARTNERS) as { id: number }[]
  ).map((row) => row.id);

  // A run needs at least one other person; with no other users, just leave the
  // availability on its own (it'll get a run later via the backfill once peers exist).
  if (partners.length === 0) return;

  // Run starts at the midpoint of the host's window.
  const time = minutesToTime(
    (timeToMinutes(slot.startTime) + timeToMinutes(slot.endTime)) / 2,
  );
  // Geocode before the synchronous DB transaction (can't await inside it).
  const meetAt = await reverseGeocode(slot.lat, slot.lon);

  db.exec("BEGIN");
  try {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO runs (date, time, distance_km, meet_at, lat, lon, availability_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(slot.date, time, slot.distanceKm, meetAt, slot.lat, slot.lon, availabilityId);
    const runId = Number(lastInsertRowid);

    const insertParticipant = db.prepare(
      "INSERT INTO run_participants (run_id, user_id, position) VALUES (?, ?, ?)",
    );
    // Host first (position 0), then the random partners.
    [hostUserId, ...partners].forEach((userId, position) => {
      insertParticipant.run(runId, userId, position);
    });

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// Availability rows that still need a run, as read back for the backfill below.
type UnscheduledAvailabilityRow = {
  id: number;
  user_id: number;
  date: string | null;
  start_time: string;
  end_time: string;
  distance_km: number;
  lat: number;
  lon: number;
};

/**
 * Generates a run for every availability slot that doesn't yet have one (legacy
 * rows, the dev seed, or slots created while their host had no peers). Idempotent
 * — it skips slots that already have a run, so it never disturbs existing runs.
 * Runs lazily once per process (see the guard in lib/availability.ts).
 */
export async function backfillRunsForUnscheduledAvailability(): Promise<void> {
  const today = isoToday();
  const rows = getDb()
    .prepare(
      `SELECT a.id, a.user_id, a.date, a.start_time, a.end_time, a.distance_km, a.lat, a.lon
       FROM availability a
       LEFT JOIN runs r ON r.availability_id = a.id
       WHERE r.id IS NULL`,
    )
    .all() as UnscheduledAvailabilityRow[];

  for (const row of rows) {
    await scheduleRunForAvailability(row.id, row.user_id, {
      // Treat legacy null-date slots as today, matching listMyAvailability's fallback.
      date: row.date ?? today,
      startTime: row.start_time,
      endTime: row.end_time,
      distanceKm: row.distance_km,
      lat: row.lat,
      lon: row.lon,
    });
  }
}

// Run the backfill at most once per process. Guarded by a flag (not just the
// idempotent skip in the query) so we don't re-scan on every page load.
let backfillChecked = false;

/** One-time-per-process wrapper around {@link backfillRunsForUnscheduledAvailability}. */
export async function ensureRunsBackfilled(): Promise<void> {
  if (backfillChecked) return;
  backfillChecked = true;
  await backfillRunsForUnscheduledAvailability();
}

/**
 * Returns every run the given user is part of that starts within the next 24
 * hours, ordered by start time. A user can have more than one: the 24h window
 * can span two calendar dates, and they may be matched on each.
 */
export function getRunsWithin24Hours(userId: number): Run[] {
  const rows = getDb()
    .prepare(
      `SELECT runs.id, runs.date, runs.time, runs.distance_km, runs.meet_at, runs.lat, runs.lon
       FROM runs
       JOIN run_participants ON run_participants.run_id = runs.id
       WHERE run_participants.user_id = ?
         AND (run_participants.visible IS NULL OR run_participants.visible = 1)
       ORDER BY runs.date IS NULL, runs.date ASC, runs.time ASC, runs.id ASC`,
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
      partners: partnersForRun(row.id, userId),
    }))
    .filter((run) => {
      // The "T..:..:00" suffix forces local-time parsing (see format-date.ts).
      const start = new Date(`${run.date}T${run.time}:00`).getTime();
      return start >= now && start <= horizon;
    });
}

export async function finishRun(runId: number, userId: number): Promise<void> {
  getDb()
    .prepare(`UPDATE run_participants SET visible = 0 WHERE run_id = ? AND user_id = ?`)
    .run(runId, userId);
}
