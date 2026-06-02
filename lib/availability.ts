import "server-only";

import { getDb } from "./db";
import { isoDateInDays, isoToday } from "./format-date";
import { recomputeRuns } from "./runs";
import { requireUser } from "./users";

export type Availability = {
  id: number;
  /** ISO date (yyyy-mm-dd) the slot applies to. Always populated: legacy rows
   *  created before the date column get a dummy fallback in listMyAvailability. */
  date: string;
  /** Start of the window, e.g. "10:00". */
  startTime: string;
  /** End of the window, e.g. "13:00". */
  endTime: string;
  /** Distance in kilometres. */
  distanceKm: number;
  /** Lower bound of pace range, in seconds per kilometre (= fastest pace). */
  paceMinSeconds: number;
  /** Upper bound of pace range, in seconds per kilometre (= slowest pace). */
  paceMaxSeconds: number;
  /** Coordinates of where they'll be, used to render the map preview. */
  lat: number;
  lon: number;
};

export type NewAvailability = Omit<Availability, "id">;

// Row shape as returned by SQLite (snake_case columns).
type AvailabilityRow = {
  id: number;
  date: string | null;
  start_time: string;
  end_time: string;
  distance_km: number;
  pace_min_seconds: number;
  pace_max_seconds: number;
  lat: number;
  lon: number;
};

async function currentUserId(): Promise<number> {
  const user = await requireUser();
  return user.id;
}

// Example slot matching the wireframe, inserted once on startup when there's no
// availability yet so the page isn't empty on first view. Remove once real
// slots are being created. Guarded by a process-level flag (not just an empty
// check) so deleting your last slot doesn't make it reappear on the next load.
const SEED: NewAvailability = {
  date: isoDateInDays(2), // a couple of days out so it isn't in the past
  startTime: "10:00",
  endTime: "13:00",
  distanceKm: 5,
  paceMinSeconds: 4 * 60 + 30, // 4:30/km
  paceMaxSeconds: 5 * 60 + 30, // 5:30/km
  lat: 51.5073,
  lon: -0.1657,
};

let seedChecked = false;

function ensureSeeded(userId: number): void {
  if (seedChecked) return;
  seedChecked = true;

  const { count } = getDb()
    .prepare("SELECT COUNT(*) AS count FROM availability")
    .get() as { count: number };
  if (count > 0) return;

  createAvailabilityFor(userId, SEED);
}

/** Inserts an availability slot for a specific user. */
export function createAvailabilityFor(userId: number, input: NewAvailability): void {
  getDb().prepare(
    `INSERT INTO availability
       (user_id, date, start_time, end_time, distance_km, pace_min_seconds, pace_max_seconds, lat, lon)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    userId,
    input.date,
    input.startTime,
    input.endTime,
    input.distanceKm,
    input.paceMinSeconds,
    input.paceMaxSeconds,
    input.lat,
    input.lon,
  );
}

/** Returns the current user's availability slots, earliest start time first. */
export async function listMyAvailability(): Promise<Availability[]> {
  const userId = await currentUserId();
  ensureSeeded(userId);

  const rows = getDb()
    .prepare(
      `SELECT id, date, start_time, end_time, distance_km, pace_min_seconds, pace_max_seconds, lat, lon
       FROM availability
       WHERE user_id = ?
       ORDER BY date IS NULL, date ASC, start_time ASC, id ASC`,
    )
    .all(userId) as AvailabilityRow[];

  return rows.map((row) => ({
    id: row.id,
    // Dummy fallback for legacy rows created before the date column existed.
    date: row.date ?? isoToday(),
    startTime: row.start_time,
    endTime: row.end_time,
    distanceKm: row.distance_km,
    paceMinSeconds: row.pace_min_seconds,
    paceMaxSeconds: row.pace_max_seconds,
    lat: row.lat,
    lon: row.lon,
  }));
}

export async function createAvailability(input: NewAvailability): Promise<void> {
  createAvailabilityFor(await currentUserId(), input);
  // Re-match everyone now that the pool of availability has changed.
  await recomputeRuns();
}

/** Deletes a slot, scoped to the current user so you can't remove someone else's. */
export async function deleteAvailability(id: number): Promise<void> {
  getDb().prepare("DELETE FROM availability WHERE id = ? AND user_id = ?").run(
    id,
    await currentUserId(),
  );
  // Re-match everyone now that the pool of availability has changed.
  await recomputeRuns();
}
