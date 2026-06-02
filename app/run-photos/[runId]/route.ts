import { readRunPhotoFile } from "@/lib/run-photos";

// The photo URL stored in the database is /run-photos/<id>?v=<timestamp>; the
// query string is purely a cache-buster, so this handler ignores it.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const id = Number(runId);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const file = await readRunPhotoFile(id);
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
