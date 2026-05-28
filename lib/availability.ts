import "server-only";

import { db } from "./db";

export type Availability = {
  id: number;
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
  start_time: string;
  end_time: string;
  distance_km: number;
  pace_min_seconds: number;
  pace_max_seconds: number;
  lat: number;
  lon: number;
};

// There's no auth yet, so a single fixed account stands in for "you". It's
// upserted lazily so availability always has a valid owner to reference.
const CURRENT_USER = { email: "sam@scorbett123.dev", name: "Sam" };

function currentUserId(): number {
  db.prepare(
    "INSERT INTO users (email, name) VALUES (?, ?) ON CONFLICT(email) DO NOTHING",
  ).run(CURRENT_USER.email, CURRENT_USER.name);
  const { id } = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(CURRENT_USER.email) as { id: number };
  return id;
}

// Example slot matching the wireframe, inserted once on startup when there's no
// availability yet so the page isn't empty on first view. Remove once real
// slots are being created. Guarded by a process-level flag (not just an empty
// check) so deleting your last slot doesn't make it reappear on the next load.
const SEED: NewAvailability = {
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

  const { count } = db
    .prepare("SELECT COUNT(*) AS count FROM availability")
    .get() as { count: number };
  if (count > 0) return;

  insertAvailability(userId, SEED);
}

function insertAvailability(userId: number, input: NewAvailability): void {
  db.prepare(
    `INSERT INTO availability
       (user_id, start_time, end_time, distance_km, pace_min_seconds, pace_max_seconds, lat, lon)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    userId,
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
export function listMyAvailability(): Availability[] {
  const userId = currentUserId();
  ensureSeeded(userId);

  const rows = db
    .prepare(
      `SELECT id, start_time, end_time, distance_km, pace_min_seconds, pace_max_seconds, lat, lon
       FROM availability
       WHERE user_id = ?
       ORDER BY start_time ASC, id ASC`,
    )
    .all(userId) as AvailabilityRow[];

  return rows.map((row) => ({
    id: row.id,
    startTime: row.start_time,
    endTime: row.end_time,
    distanceKm: row.distance_km,
    paceMinSeconds: row.pace_min_seconds,
    paceMaxSeconds: row.pace_max_seconds,
    lat: row.lat,
    lon: row.lon,
  }));
}

export function createAvailability(input: NewAvailability): void {
  insertAvailability(currentUserId(), input);
}

/** Deletes a slot, scoped to the current user so you can't remove someone else's. */
export function deleteAvailability(id: number): void {
  db.prepare("DELETE FROM availability WHERE id = ? AND user_id = ?").run(
    id,
    currentUserId(),
  );
}
