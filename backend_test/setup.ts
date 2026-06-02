import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll } from "vitest";

// Point the data layer at a throwaway SQLite file BEFORE any lib/* module is
// imported. lib/db.ts reads process.env.DATABASE_PATH once, at module-eval time,
// so this must run first — Vitest evaluates setupFiles before the test modules
// (and therefore before lib/db.ts) are loaded.
//
// One temp database per test file: Vitest isolates each test file in its own
// module registry, so this setup (and lib/db.ts's cached connection) runs fresh
// per file. Tests within a single file share the database.
const dir = mkdtempSync(join(tmpdir(), "drp-backend-test-"));
process.env.DATABASE_PATH = join(dir, "app.db");

// Remove the temp database (including its -wal / -shm sidecars) after the file's
// tests finish, so runs don't leave files behind in the OS temp directory.
afterAll(async () => {
  // Close the connection first: on Windows an open SQLite handle keeps the file
  // locked, so the directory can't be removed. Imported dynamically (not at the
  // top of this file) so it resolves AFTER DATABASE_PATH is set above.
  const { getDb } = await import("@/lib/db");
  getDb().close();
  rmSync(dir, { recursive: true, force: true });
});
