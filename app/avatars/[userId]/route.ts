import { readAvatarFile } from "@/lib/avatars";

// The avatar URL stored in the database is /avatars/<id>?v=<timestamp>; the
// query string is purely a cache-buster, so this handler ignores it.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const file = await readAvatarFile(id);
  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      // The stored URL changes its `v` query param on every upload, so the
      // file at a given URL is effectively immutable. Cache aggressively.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
