import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getDb } from "./db";
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

/**
 * A user whose profile fields are all set. Pages behind the onboarding gate
 * receive this narrower type so they don't have to handle nullable fields.
 */
export type CompleteUser = Omit<
  User,
  "dateOfBirth" | "gender" | "preferredPaceSeconds"
> & {
  dateOfBirth: string;
  gender: string;
  preferredPaceSeconds: number;
};

export function isProfileComplete(user: User): user is CompleteUser {
  return (
    user.dateOfBirth !== null &&
    user.gender !== null &&
    user.preferredPaceSeconds !== null
  );
}

export type NewUser = {
  email: string;
  name: string;
  dateOfBirth: string;
  gender: Gender;
  preferredPaceSeconds: number;
};

export type ProfileUpdate = {
  name: string;
  dateOfBirth: string;
  gender: Gender;
  preferredPaceSeconds: number;
};

/** Looks up a user by email. Returns null if there's no such account. */
export function findUserByEmail(email: string): User | null {
  const row = getDb()
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`)
    .get(email) as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

/** Creates a brand-new user with all required profile fields supplied. */
export function createUser(input: NewUser): User {
  const { lastInsertRowid } = getDb()
    .prepare(
      `INSERT INTO users (email, name, date_of_birth, gender, preferred_pace_seconds)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      input.email,
      input.name,
      input.dateOfBirth,
      input.gender,
      input.preferredPaceSeconds,
    );
  const row = getDb()
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
    .get(Number(lastInsertRowid)) as UserRow;
  return rowToUser(row);
}

/** Sets or clears the user's avatar URL. */
export function updateUserAvatar(userId: number, avatar: string | null): void {
  db.prepare(`UPDATE users SET avatar = ? WHERE id = ?`).run(avatar, userId);
}

/** Persists user-editable profile fields. */
export function updateUserProfile(userId: number, fields: ProfileUpdate): void {
  getDb().prepare(
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
  const row = getDb()
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
    .get(id) as UserRow | undefined;
  return row ? rowToUser(row) : null;
});

/**
 * Returns the current user or redirects to /login. Use this in Server
 * Components and Server Actions that need an authenticated user but don't
 * require the profile to be fully filled in (e.g. the /welcome page itself).
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Returns the current user only if they've finished onboarding. Redirects
 * to /login (which also serves as the signup / finish-profile page) when
 * the visitor isn't signed in or hasn't filled in every profile field.
 */
export async function requireCompleteUser(): Promise<CompleteUser> {
  const user = await getCurrentUser();
  if (!user || !isProfileComplete(user)) redirect("/login");
  return user;
}

/** Lists all users in the database, newest first. Used by the admin page. */
export function listUsers(): User[] {
  const rows = getDb()
    .prepare(
      `SELECT ${USER_COLUMNS} FROM users ORDER BY created_at DESC, id DESC`,
    )
    .all() as UserRow[];
  return rows.map(rowToUser);
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
