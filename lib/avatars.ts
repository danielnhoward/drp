import "server-only";

import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";

// Avatars live alongside the SQLite database so they share the same persistent
// volume in production. DATABASE_PATH overrides the DB location and we mirror
// that here so a custom data directory keeps the two together.
const dataDir = process.env.DATABASE_PATH
  ? dirname(process.env.DATABASE_PATH)
  : join(process.cwd(), "data");

const AVATAR_DIR = join(dataDir, "avatars");

// 5 MB matches the serverActions.bodySizeLimit in next.config.ts. Keep these
// two in sync — the server action body limit kicks in first, so dropping it
// without lowering the config makes the error message worse, not better.
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// Map of MIME types we accept to the on-disk extension we save them with.
// Restricting to these three covers every modern browser's <input type="file">
// without dragging in an image conversion library.
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

export type SaveAvatarResult = { url: string } | { error: string };

/**
 * Persists an uploaded avatar and returns the URL to store in the user's
 * `avatar` column. The URL carries a cache-busting `v` so the browser picks
 * up a freshly uploaded picture instead of a stale cached one.
 */
export async function saveAvatarFile(
  userId: number,
  file: File,
): Promise<SaveAvatarResult> {
  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    return { error: "Use a JPEG, PNG, or WebP image." };
  }
  if (file.size === 0) {
    return { error: "That file is empty." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "Image is too large — keep it under 5 MB." };
  }

  await mkdir(AVATAR_DIR, { recursive: true });
  // Clear any previously-uploaded file for this user, including ones with a
  // different extension, so we never leave two avatars on disk for one user.
  await removeAvatarFiles(userId);

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(join(AVATAR_DIR, `${userId}.${ext}`), bytes);

  // The query string only exists to bust Next.js Image / browser caches when
  // the user uploads a replacement — the route handler ignores it.
  return { url: `/avatars/${userId}?v=${Date.now()}` };
}

/** Deletes any stored avatar for the user. No-op if none exists. */
export async function deleteAvatarFile(userId: number): Promise<void> {
  await removeAvatarFiles(userId);
}

/** Reads the user's avatar file, or null if they have none. */
export async function readAvatarFile(
  userId: number,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const filename = await findAvatarFilename(userId);
  if (!filename) return null;
  const ext = extname(filename).slice(1).toLowerCase();
  const contentType = EXT_TO_MIME[ext];
  if (!contentType) return null;
  const bytes = await readFile(join(AVATAR_DIR, filename));
  return { bytes, contentType };
}

async function findAvatarFilename(userId: number): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(AVATAR_DIR);
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
  const prefix = `${userId}.`;
  return entries.find((name) => name.startsWith(prefix)) ?? null;
}

async function removeAvatarFiles(userId: number): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(AVATAR_DIR);
  } catch (err) {
    if (isMissing(err)) return;
    throw err;
  }
  const prefix = `${userId}.`;
  await Promise.all(
    entries
      .filter((name) => name.startsWith(prefix))
      .map((name) => unlink(join(AVATAR_DIR, name))),
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
