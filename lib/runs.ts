import "server-only";

import { db } from "./db";

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

// Dummy seed data — inserted once, when the runs table is empty, so the app
// shows an example out of the box. Remove once real data is being created.
const SEED_USERS = [
  {
    email: "david@example.com",
    name: "David",
    avatar: "https://randomuser.me/api/portraits/men/32.jpg",
  },
  {
    email: "sarah@example.com",
    name: "Sarah",
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
  },
];

const SEED_RUN = {
  time: "10:00",
  distanceKm: 5,
  meetAt: "123 East Road",
  lat: 51.5073,
  lon: -0.1657,
  // Emails of the seeded users running together, in display order.
  partnerEmails: ["david@example.com", "sarah@example.com"],
};

function ensureSeeded(): void {
  const { count } = db
    .prepare("SELECT COUNT(*) AS count FROM runs")
    .get() as { count: number };
  if (count > 0) return;

  // Upsert the users so the run can reference them by id.
  const upsertUser = db.prepare(
    `INSERT INTO users (email, name, avatar) VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET name = excluded.name, avatar = excluded.avatar`,
  );
  const findUser = db.prepare("SELECT id FROM users WHERE email = ?");
  const userIdByEmail = new Map<string, number>();
  for (const user of SEED_USERS) {
    upsertUser.run(user.email, user.name, user.avatar);
    const { id } = findUser.get(user.email) as { id: number };
    userIdByEmail.set(user.email, id);
  }

  const { lastInsertRowid: runId } = db
    .prepare(
      "INSERT INTO runs (time, distance_km, meet_at, lat, lon) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      SEED_RUN.time,
      SEED_RUN.distanceKm,
      SEED_RUN.meetAt,
      SEED_RUN.lat,
      SEED_RUN.lon,
    );

  const linkParticipant = db.prepare(
    "INSERT INTO run_participants (run_id, user_id, position) VALUES (?, ?, ?)",
  );
  SEED_RUN.partnerEmails.forEach((email, i) =>
    linkParticipant.run(runId, userIdByEmail.get(email)!, i),
  );
}

function partnersForRun(runId: number): Runner[] {
  return db
    .prepare(
      `SELECT users.name AS name, users.avatar AS avatar
       FROM run_participants
       JOIN users ON users.id = run_participants.user_id
       WHERE run_participants.run_id = ?
       ORDER BY run_participants.position ASC`,
    )
    .all(runId) as Runner[];
}

/** Returns the next upcoming run, or null if there are none. */
export function getNextRun(): Run | null {
  ensureSeeded();

  const row = db
    .prepare(
      "SELECT id, time, distance_km, meet_at, lat, lon FROM runs ORDER BY time ASC, id ASC LIMIT 1",
    )
    .get() as RunRow | undefined;
  if (!row) return null;

  return {
    id: row.id,
    time: row.time,
    distanceKm: row.distance_km,
    meetAt: row.meet_at,
    lat: row.lat,
    lon: row.lon,
    partners: partnersForRun(row.id),
  };
}
