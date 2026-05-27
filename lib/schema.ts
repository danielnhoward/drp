import type { DatabaseSync } from "node:sqlite";

// Table definitions. Each runs with CREATE TABLE IF NOT EXISTS so applying the
// schema to an existing database is a no-op — safe to run on every connection.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  -- COLLATE NOCASE makes lookups and the UNIQUE constraint case-insensitive,
  -- so "Sam@x.com" and "sam@x.com" are treated as the same address.
  email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export type User = {
  id: number;
  email: string;
  name: string;
  created_at: string;
};

export function initSchema(connection: DatabaseSync): void {
  connection.exec(SCHEMA);
}
