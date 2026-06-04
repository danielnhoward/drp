import "server-only";

import { getDb } from "./db";

export type RatingSummary = {
  average: number | null;
  count: number;
};

export type RunRatingInput = {
  ratedUserId: number;
  stars: number;
  note?: string | null;
};

type RatingSummaryRow = {
  average: number | null;
  count: number;
};

const MAX_NOTE_LENGTH = 280;

function participantIdsForRun(runId: number): number[] {
  const rows = getDb()
    .prepare(
      `SELECT user_id
       FROM run_participants
       WHERE run_id = ?
       ORDER BY position ASC, user_id ASC`,
    )
    .all(runId) as { user_id: number }[];
  return rows.map((row) => row.user_id);
}

function cleanNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.slice(0, MAX_NOTE_LENGTH) : null;
}

export function getRatingSummaryForUser(userId: number): RatingSummary {
  const row = getDb()
    .prepare(
      `SELECT AVG(stars) AS average, COUNT(*) AS count
       FROM run_ratings
       WHERE rated_user_id = ?`,
    )
    .get(userId) as RatingSummaryRow;

  return {
    average: row.average,
    count: row.count,
  };
}

export function saveRunRatings(
  runId: number,
  raterUserId: number,
  ratings: RunRatingInput[],
): void {
  if (!Number.isInteger(runId) || runId <= 0) {
    throw new Error("Invalid run.");
  }
  if (!Number.isInteger(raterUserId) || raterUserId <= 0) {
    throw new Error("Invalid user.");
  }

  const participantIds = participantIdsForRun(runId);
  if (!participantIds.includes(raterUserId)) {
    throw new Error("You can only rate runs you joined.");
  }

  const ratablePartnerIds = participantIds.filter((id) => id !== raterUserId);
  const expected = new Set(ratablePartnerIds);
  const byRatedUser = new Map<number, RunRatingInput>();

  for (const rating of ratings) {
    if (!Number.isInteger(rating.ratedUserId) || !expected.has(rating.ratedUserId)) {
      throw new Error("You can only rate partners from this run.");
    }
    if (!Number.isInteger(rating.stars) || rating.stars < 1 || rating.stars > 5) {
      throw new Error("Choose a 1 to 5 star rating for every partner.");
    }
    if (byRatedUser.has(rating.ratedUserId)) {
      throw new Error("Each partner can only be rated once per run.");
    }
    byRatedUser.set(rating.ratedUserId, rating);
  }

  if (byRatedUser.size !== ratablePartnerIds.length) {
    throw new Error("Rate every runner you met on this run.");
  }

  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO run_ratings (run_id, rater_user_id, rated_user_id, stars, note)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(run_id, rater_user_id, rated_user_id) DO UPDATE SET
       stars = excluded.stars,
       note = excluded.note,
       updated_at = datetime('now')`,
  );

  db.exec("BEGIN");
  try {
    for (const ratedUserId of ratablePartnerIds) {
      const rating = byRatedUser.get(ratedUserId);
      if (!rating) {
        throw new Error("Rate every runner you met on this run.");
      }
      upsert.run(
        runId,
        raterUserId,
        ratedUserId,
        rating.stars,
        cleanNote(rating.note),
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
