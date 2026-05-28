import type { DatabaseSync } from "node:sqlite";

// Table definitions. Each runs with CREATE TABLE IF NOT EXISTS so applying the
// schema to an existing database is a no-op — safe to run on every connection.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  -- COLLATE NOCASE makes lookups and the UNIQUE constraint case-insensitive,
  -- so "Sam@x.com" and "sam@x.com" are treated as the same address.
  email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name       TEXT NOT NULL,
  avatar     TEXT,                     -- URL of the user's profile picture
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  time        TEXT NOT NULL,            -- start time of day, e.g. "10:00"
  distance_km REAL NOT NULL,
  meet_at     TEXT NOT NULL,            -- meeting point address
  lat         REAL NOT NULL,
  lon         REAL NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Join table linking runs to the users running together. ON DELETE CASCADE
-- clears the links when either side is removed (foreign keys enabled in db.ts).
CREATE TABLE IF NOT EXISTS run_participants (
  run_id   INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0, -- preserves display order
  PRIMARY KEY (run_id, user_id)
);

-- A user's availability slots, set on the "My Schedule" page: when they're
-- free to run, how far, how fast, and roughly where they'll be (lat/lon, so we
-- can match them with nearby partners). The actual meeting point is chosen
-- later by the matching system, not stored here.
CREATE TABLE IF NOT EXISTS availability (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time          TEXT NOT NULL,            -- start of the window, e.g. "10:00"
  end_time            TEXT NOT NULL,            -- end of the window, e.g. "13:00"
  distance_km         REAL NOT NULL,
  pace_min_seconds    INTEGER NOT NULL,         -- lower bound of pace range, in seconds/km (= fastest pace)
  pace_max_seconds    INTEGER NOT NULL,         -- upper bound of pace range, in seconds/km (= slowest pace)
  lat                 REAL NOT NULL,            -- coordinates for the map preview
  lon                 REAL NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_availability_user ON availability (user_id);
`;

export type User = {
  id: number;
  email: string;
  name: string;
  avatar: string | null;
  created_at: string;
};

export function initSchema(connection: DatabaseSync): void {
  connection.exec(SCHEMA);
}
