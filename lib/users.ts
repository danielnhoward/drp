import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { estimateFiveKPaceSeconds } from "./coach";
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
  pronouns: string | null;
  preferred_pace_seconds: number | null;
  why_run: string | null;
  hobbies: string | null;
  interests: string | null;
  coach_status: string | null;
  coach_session_index: number | null;
  created_at: string;
};

const USER_COLUMNS =
  "id, email, name, avatar, date_of_birth, gender, pronouns, preferred_pace_seconds, why_run, hobbies, interests, coach_status, coach_session_index, created_at";

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar: row.avatar,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    pronouns: row.pronouns,
    preferredPaceSeconds: row.preferred_pace_seconds,
    whyRun: row.why_run,
    hobbies: row.hobbies,
    interests: row.interests,
    coachStatus: row.coach_status,
    coachSessionIndex: row.coach_session_index,
    created_at: row.created_at,
  };
}

/**
 * A user whose required profile fields are all set. Pages behind the onboarding
 * gate receive this narrower type so they don't have to handle the nullable
 * required fields. Pace stays nullable here — it's optional now.
 */
export type CompleteUser = Omit<User, "dateOfBirth" | "gender"> & {
  dateOfBirth: string;
  gender: string;
};

export function isProfileComplete(user: User): user is CompleteUser {
  return user.dateOfBirth !== null && user.gender !== null;
}

export type NewUser = {
  email: string;
  name: string;
  dateOfBirth: string;
  gender: Gender;
};

export type ProfileUpdate = {
  name: string;
  dateOfBirth: string;
  gender: Gender;
  // Optional fields. Updates are not partial — every column is written on each
  // update, so a field left undefined is treated as null (cleared). Callers that
  // don't collect them (e.g. onboarding) may leave them undefined.
  preferredPaceSeconds?: number | null;
  whyRun?: string | null;
  hobbies?: string | null;
  interests?: string | null;
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
      `INSERT INTO users (email, name, date_of_birth, gender)
       VALUES (?, ?, ?, ?)`,
    )
    .run(input.email, input.name, input.dateOfBirth, input.gender);
  const row = getDb()
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`)
    .get(Number(lastInsertRowid)) as UserRow;
  return rowToUser(row);
}

/** Sets or clears the user's avatar URL. */
export function updateUserAvatar(userId: number, avatar: string | null): void {
  getDb().prepare(`UPDATE users SET avatar = ? WHERE id = ?`).run(avatar, userId);
}

/** Sets or clears the user's display pronouns. */
export function updateUserPronouns(userId: number, pronouns: string | null): void {
  getDb().prepare(`UPDATE users SET pronouns = ? WHERE id = ?`).run(pronouns, userId);
}

/** Persists user-editable profile fields. */
export function updateUserProfile(userId: number, fields: ProfileUpdate): void {
  getDb().prepare(
    `UPDATE users
        SET name = ?,
            date_of_birth = ?,
            gender = ?,
            preferred_pace_seconds = ?,
            why_run = ?,
            hobbies = ?,
            interests = ?
      WHERE id = ?`,
  ).run(
    fields.name,
    fields.dateOfBirth,
    fields.gender,
    fields.preferredPaceSeconds ?? null,
    fields.whyRun ?? null,
    fields.hobbies ?? null,
    fields.interests ?? null,
    userId,
  );
}

/**
 * Enrolls a runner in the getting-started plan, starting at the first session.
 * Called when a new user says they haven't run before during onboarding.
 */
export function enrollUserInCoaching(userId: number): void {
  getDb()
    .prepare(
      `UPDATE users SET coach_status = 'active', coach_session_index = 0 WHERE id = ?`,
    )
    .run(userId);
}

/** Moves an enrolled runner to a given plan session (see lib/coach.ts). */
export function setCoachSessionIndex(userId: number, index: number): void {
  getDb()
    .prepare(`UPDATE users SET coach_session_index = ? WHERE id = ?`)
    .run(index, userId);
}

/**
 * Marks a runner as graduated from the getting-started plan and seeds the
 * comfortable pace that normal matching needs — but only if they don't already
 * have one, so a manually-set pace is never clobbered.
 */
export function graduateUser(userId: number): void {
  getDb()
    .prepare(
      `UPDATE users
          SET coach_status = 'graduated',
              preferred_pace_seconds = COALESCE(preferred_pace_seconds, ?)
        WHERE id = ?`,
    )
    .run(estimateFiveKPaceSeconds(), userId);
}

/** Removes a runner from the guided plan without changing their pace. */
export function leaveUserCoaching(userId: number): void {
  getDb()
    .prepare(
      `UPDATE users
          SET coach_status = NULL,
              coach_session_index = NULL
        WHERE id = ?`,
    )
    .run(userId);
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
