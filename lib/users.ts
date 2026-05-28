import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "./db";
import type { Gender } from "./gender";
import type { User } from "./schema";

// Name of the cookie that holds the logged-in user's id. There's no password
// or signature on this — the app is single-tenant and the admin page openly
// allows impersonation, so a tamper-proof session adds nothing.
const SESSION_COOKIE = "session";

// Long enough that nobody gets logged out during normal use; short enough that
// a stolen device eventually loses access.
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type UserRow = {
  id: number;
  email: string;
  name: string;
  avatar: string | null;
  date_of_birth: string | null;
  gender: string | null;
  preferred_pace_seconds: number | null;
  created_at: string;
};

const USER_COLUMNS =
  "id, email, name, avatar, date_of_birth, gender, preferred_pace_seconds, created_at";

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar: row.avatar,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    preferredPaceSeconds: row.preferred_pace_seconds,
    created_at: row.created_at,
  };
}

export type ProfileUpdate = {
  name: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  preferredPaceSeconds: number | null;
};

/** Persists user-editable profile fields. */
export function updateUserProfile(userId: number, fields: ProfileUpdate): void {
  db.prepare(
    `UPDATE users
        SET name = ?,
            date_of_birth = ?,
            gender = ?,
            preferred_pace_seconds = ?
      WHERE id = ?`,
  ).run(
    fields.name,
    fields.dateOfBirth,
    fields.gender,
    fields.preferredPaceSeconds,
    userId,
  );
}

/** Reads the session cookie. Returns the user id, or null if not set. */
async function getSessionUserId(): Promise<number | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Returns the currently logged-in user, or null if there's no valid session.
 * Memoised per request so calling it in multiple components doesn't re-query.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const id = await getSessionUserId();
  if (id === null) return null;
  const row = db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
    .get(id) as UserRow | undefined;
  return row ? rowToUser(row) : null;
});

/**
 * Returns the current user or redirects to /login. Use this in Server
 * Components and Server Actions that require an authenticated user.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Lists all users in the database, newest first. Used by the admin page. */
export function listUsers(): User[] {
  const rows = db
    .prepare(
      `SELECT ${USER_COLUMNS} FROM users ORDER BY created_at DESC, id DESC`,
    )
    .all() as UserRow[];
  return rows.map(rowToUser);
}

/**
 * Looks up a user by email, creating them if they don't exist. The name is
 * only used on creation; subsequent logins keep the stored name.
 */
export function findOrCreateUser(email: string, name: string): User {
  db.prepare(
    "INSERT INTO users (email, name) VALUES (?, ?) ON CONFLICT(email) DO NOTHING",
  ).run(email, name);
  const row = db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`)
    .get(email) as UserRow;
  return rowToUser(row);
}

/** Writes the session cookie. */
export async function setSessionUser(userId: number): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, String(userId), {
    httpOnly: true,
    // The dev server is plain http, so don't gate on https there.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Clears the session cookie. */
export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
