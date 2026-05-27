import "server-only";

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { initSchema } from "./schema";

// Resolve the database file location. Override with DATABASE_PATH (e.g. an
// absolute path to a mounted volume in production); defaults to ./data/app.db.
const dbPath = process.env.DATABASE_PATH ?? join(process.cwd(), "data", "app.db");

function createConnection(): DatabaseSync {
  mkdirSync(dirname(dbPath), { recursive: true });

  const connection = new DatabaseSync(dbPath);
  // WAL gives better read/write concurrency; foreign keys are off by default.
  connection.exec("PRAGMA journal_mode = WAL;");
  connection.exec("PRAGMA foreign_keys = ON;");
  initSchema(connection);
  return connection;
}

// Next.js hot-reloads server modules in development, which would otherwise open
// a new connection on every edit. Cache it on globalThis to keep a single one.
const globalForDb = globalThis as typeof globalThis & {
  __db?: DatabaseSync;
};

export const db = globalForDb.__db ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__db = db;
}
