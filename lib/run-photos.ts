import "server-only";

import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";

// Group photos live alongside the SQLite database so they share the same
// persistent volume in production, mirroring how avatars are stored.
// DATABASE_PATH overrides the DB location and we follow it here so a custom
// data directory keeps the database and its photos together.
const dataDir = process.env.DATABASE_PATH
  ? dirname(process.env.DATABASE_PATH)
  : join(process.cwd(), "data");

const RUN_PHOTO_DIR = join(dataDir, "run-photos");

// 5 MB matches the serverActions.bodySizeLimit in next.config.ts (shared with
// avatar uploads). Keep these in sync — the server action body limit kicks in
// first, so dropping this without lowering the config makes the error message
// worse, not better.
export const MAX_RUN_PHOTO_BYTES = 5 * 1024 * 1024;

// Map of MIME types we accept to the on-disk extension we save them with.
// Restricting to these three covers every modern browser's <input type="file">
// (and camera capture) without dragging in an image conversion library.
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export type SaveRunPhotoResult = { url: string } | { error: string };

/**
 * Persists an uploaded group photo for a run and returns the URL to store in
 * the run's `photo` column. The URL carries a cache-busting `v` so the browser
 * picks up a freshly uploaded photo instead of a stale cached one.
 */
export async function saveRunPhotoFile(
  runId: number,
  file: File,
): Promise<SaveRunPhotoResult> {
  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    return { error: "Use a JPEG, PNG, or WebP image." };
  }
  if (file.size === 0) {
    return { error: "That file is empty." };
  }
  if (file.size > MAX_RUN_PHOTO_BYTES) {
    return { error: "Photo is too large — keep it under 5 MB." };
  }

  await mkdir(RUN_PHOTO_DIR, { recursive: true });
  // Clear any previously-uploaded photo for this run, including ones with a
  // different extension, so we never leave two photos on disk for one run.
  await removeRunPhotoFiles(runId);

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(join(RUN_PHOTO_DIR, `${runId}.${ext}`), bytes);

  // The query string only exists to bust Next.js Image / browser caches when
  // a replacement photo is uploaded — the route handler ignores it.
  return { url: `/run-photos/${runId}?v=${Date.now()}` };
}

/** Deletes any stored group photo for the run. No-op if none exists. */
export async function deleteRunPhotoFile(runId: number): Promise<void> {
  await removeRunPhotoFiles(runId);
}

/** Reads the run's group photo, or null if it has none. */
export async function readRunPhotoFile(
  runId: number,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const filename = await findRunPhotoFilename(runId);
  if (!filename) return null;
  const ext = extname(filename).slice(1).toLowerCase();
  const contentType = EXT_TO_MIME[ext];
  if (!contentType) return null;
  const bytes = await readFile(join(RUN_PHOTO_DIR, filename));
  return { bytes, contentType };
}

async function findRunPhotoFilename(runId: number): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(RUN_PHOTO_DIR);
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
  const prefix = `${runId}.`;
  return entries.find((name) => name.startsWith(prefix)) ?? null;
}

async function removeRunPhotoFiles(runId: number): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(RUN_PHOTO_DIR);
  } catch (err) {
    if (isMissing(err)) return;
    throw err;
  }
  const prefix = `${runId}.`;
  await Promise.all(
    entries
      .filter((name) => name.startsWith(prefix))
      .map((name) => unlink(join(RUN_PHOTO_DIR, name))),
  );
}

function isMissing(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "ENOENT"
  );
}
