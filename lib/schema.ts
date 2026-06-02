import type { DatabaseSync } from "node:sqlite";

// Table definitions. Each runs with CREATE TABLE IF NOT EXISTS so applying the
// schema to an existing database is a no-op — safe to run on every connection.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  -- COLLATE NOCASE makes lookups and the UNIQUE constraint case-insensitive,
  -- so "Sam@x.com" and "sam@x.com" are treated as the same address.
  email                  TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name                   TEXT NOT NULL,
  avatar                 TEXT,                          -- URL of the user's profile picture
  -- NOT NULL on fresh databases. On existing databases these columns were
  -- added later by migrateUserColumns as nullable (SQLite can't ALTER to
  -- NOT NULL without rebuilding the table), so legacy rows may still hold
  -- NULL. The /welcome onboarding gate redirects any such user to fill them
  -- in before they can use the rest of the site.
  date_of_birth          TEXT NOT NULL,                 -- ISO yyyy-mm-dd; age is derived
  gender                 TEXT NOT NULL,                 -- one of GENDERS in lib/gender.ts
  preferred_pace_seconds INTEGER NOT NULL,              -- typical comfortable pace, seconds per km
  -- Optional, free-text "get to know me" fields. Never required: they exist so
  -- runners can share more than bare stats and break the ice before a first run.
  why_run                TEXT,                          -- why they like running with others
  hobbies                TEXT,                          -- recent non-running hobbies
  interests              TEXT,                          -- other interests / talking points
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT,                     -- ISO yyyy-mm-dd; nullable until the matching system sets it
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
  visible  INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (run_id, user_id)
);

-- A user's availability slots, set on the "My Schedule" page: when they're
-- free to run, how far, how fast, and roughly where they'll be (lat/lon, so we
-- can match them with nearby partners). The actual meeting point is chosen
-- later by the matching system, not stored here.
CREATE TABLE IF NOT EXISTS availability (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date                TEXT NOT NULL,            -- ISO yyyy-mm-dd, the day this slot applies to
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
  /** ISO date string (yyyy-mm-dd) or null if not set. */
  dateOfBirth: string | null;
  /** One of the values in GENDERS (lib/users.ts), or null. */
  gender: string | null;
  /** Typical comfortable pace, in seconds per kilometre, or null. */
  preferredPaceSeconds: number | null;
  /** Optional free text: why they enjoy running with others, or null. */
  whyRun: string | null;
  /** Optional free text: recent non-running hobbies, or null. */
  hobbies: string | null;
  /** Optional free text: other interests / conversation starters, or null. */
  interests: string | null;
  created_at: string;
};

// Columns added after the initial release. SQLite's CREATE TABLE IF NOT EXISTS
// is a no-op when the table is already there, so new columns wouldn't appear
// on an existing database without an explicit ALTER. Each entry is applied
// idempotently in initSchema by checking PRAGMA table_info first.
//
// Columns are added nullable here even where the CREATE TABLE above declares
// them NOT NULL: SQLite can't ALTER ADD a NOT NULL column without a default, so
// legacy rows may hold NULL until backfilled (see the date_of_birth note above).
const USER_COLUMN_MIGRATIONS: ReadonlyArray<[string, string]> = [
  ["date_of_birth", "TEXT"],
  ["gender", "TEXT"],
  ["preferred_pace_seconds", "INTEGER"],
  ["why_run", "TEXT"],
  ["hobbies", "TEXT"],
  ["interests", "TEXT"],
];

const AVAILABILITY_COLUMN_MIGRATIONS: ReadonlyArray<[string, string]> = [
  ["date", "TEXT"],
];

const RUN_COLUMN_MIGRATIONS: ReadonlyArray<[string, string]> = [["date", "TEXT"]];

const RUN_PARTICIPANT_COLUMN_MIGRATIONS: ReadonlyArray<[string, string]> = [["visible", "INTEGER"]];

// Adds any columns from `migrations` the table doesn't already have. The table
// name is a hardcoded constant (never user input), so interpolating it is safe.
function addMissingColumns(
  connection: DatabaseSync,
  table: string,
  migrations: ReadonlyArray<[string, string]>,
): void {
  const existing = new Set(
    (connection.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
      (c) => c.name,
    ),
  );
  for (const [name, type] of migrations) {
    if (!existing.has(name)) {
      connection.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    }
  }
}

export function initSchema(connection: DatabaseSync): void {
  connection.exec(SCHEMA);
  addMissingColumns(connection, "users", USER_COLUMN_MIGRATIONS);
  addMissingColumns(connection, "availability", AVAILABILITY_COLUMN_MIGRATIONS);
  addMissingColumns(connection, "runs", RUN_COLUMN_MIGRATIONS);
  addMissingColumns(connection, "run_participants", RUN_PARTICIPANT_COLUMN_MIGRATIONS);
}
