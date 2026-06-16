import { beforeEach, describe, expect, test } from "vitest";

import {
  getRatingSummaryForUser,
  saveRunRatings,
} from "@/lib/ratings";
import { createUser } from "@/lib/users";

import { getDb, makeFakeUser } from "./harness";

function createRunWithParticipants(userIds: number[]): number {
  const { lastInsertRowid } = getDb()
    .prepare(
      `INSERT INTO runs (date, time, distance_km, meet_at, lat, lon)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run("2026-06-10", "11:00", 5, "Mocked Location", 51.5, -0.1);

  const runId = Number(lastInsertRowid);
  const insertParticipant = getDb().prepare(
    `INSERT INTO run_participants (run_id, user_id, position)
     VALUES (?, ?, ?)`,
  );
  userIds.forEach((userId, position) => {
    insertParticipant.run(runId, userId, position);
  });

  return runId;
}

beforeEach(() => {
  getDb().exec(
    "DELETE FROM run_ratings; DELETE FROM run_participants; DELETE FROM runs; DELETE FROM users;",
  );
});

describe("run ratings", () => {
  test("aggregates ratings into a user trust score", () => {
    const alice = createUser(makeFakeUser({ name: "Alice" }));
    const bob = createUser(makeFakeUser({ name: "Bob" }));
    const cara = createUser(makeFakeUser({ name: "Cara" }));
    const runId = createRunWithParticipants([alice.id, bob.id, cara.id]);

    saveRunRatings(runId, alice.id, [
      { ratedUserId: bob.id, stars: 5 },
      { ratedUserId: cara.id, stars: 1 },
    ]);
    saveRunRatings(runId, cara.id, [
      { ratedUserId: alice.id, stars: 5 },
      { ratedUserId: bob.id, stars: 5 },
    ]);

    expect(getRatingSummaryForUser(bob.id)).toEqual({
      average: 5,
      count: 2,
    });
    expect(getRatingSummaryForUser(alice.id)).toEqual({
      average: 5,
      count: 1,
    });
  });

  test("updates an existing rating for the same run and partner", () => {
    const alice = createUser(makeFakeUser({ name: "Alice" }));
    const bob = createUser(makeFakeUser({ name: "Bob" }));
    const runId = createRunWithParticipants([alice.id, bob.id]);

    saveRunRatings(runId, alice.id, [{ ratedUserId: bob.id, stars: 5 }]);
    saveRunRatings(runId, alice.id, [{ ratedUserId: bob.id, stars: 1 }]);

    expect(getRatingSummaryForUser(bob.id)).toEqual({
      average: 1,
      count: 1,
    });
  });

  test("requires ratings for every other participant", () => {
    const alice = createUser(makeFakeUser({ name: "Alice" }));
    const bob = createUser(makeFakeUser({ name: "Bob" }));
    const cara = createUser(makeFakeUser({ name: "Cara" }));
    const runId = createRunWithParticipants([alice.id, bob.id, cara.id]);

    expect(() =>
      saveRunRatings(runId, alice.id, [{ ratedUserId: bob.id, stars: 5 }]),
    ).toThrow("Rate every runner");
  });

  test("rejects ratings for users outside the run", () => {
    const alice = createUser(makeFakeUser({ name: "Alice" }));
    const bob = createUser(makeFakeUser({ name: "Bob" }));
    const outsider = createUser(makeFakeUser({ name: "Outsider" }));
    const runId = createRunWithParticipants([alice.id, bob.id]);

    expect(() =>
      saveRunRatings(runId, alice.id, [
        { ratedUserId: outsider.id, stars: 5 },
      ]),
    ).toThrow("partners from this run");
  });
});
