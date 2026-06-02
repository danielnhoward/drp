import { describe, expect, test } from "vitest";

import { createUser, findUserByEmail, listUsers } from "@/lib/users";

import { getDb, makeFakeUser } from "./harness";

describe("users data layer", () => {
  test("inserts fake users and queries them back", () => {
    const alice = createUser(makeFakeUser({ email: "alice@example.com", name: "Alice" }));
    const bob = createUser(makeFakeUser({ email: "bob@example.com", name: "Bob" }));

    expect(alice.id).toBeGreaterThan(0);
    expect(bob.id).toBeGreaterThan(alice.id);

    // Query back through the backend function (runs a SELECT internally).
    const listed = listUsers();
    expect(listed).toHaveLength(2);
    expect(listed.map((u) => u.email).sort()).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);

    // Query back with a literal SELECT against the spun-up test database.
    const rows = getDb()
      .prepare("SELECT email, name FROM users ORDER BY id")
      .all() as { email: string; name: string }[];
    expect(rows).toEqual([
      { email: "alice@example.com", name: "Alice" },
      { email: "bob@example.com", name: "Bob" },
    ]);
  });

  test("findUserByEmail returns the match, or null when absent", () => {
    const created = createUser(makeFakeUser());

    const found = findUserByEmail(created.email);
    expect(found?.id).toBe(created.id);
    expect(found?.name).toBe(created.name);

    expect(findUserByEmail("nobody@example.com")).toBeNull();
  });
});
