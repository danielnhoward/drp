import { isRunParticipant } from "@/lib/runs";
import { subscribeRunEvents, type RunRealtimeEvent } from "@/lib/realtime";
import { requireUser } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const id = Number(runId);
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const user = await requireUser();
  if (!isRunParticipant(id, user.id)) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    try {
      controller?.close();
    } catch {
      // Stream may already be closed.
    }
  };

  const writeRaw = (chunk: string) => {
    if (closed || !controller) return;
    try {
      controller.enqueue(encoder.encode(chunk));
    } catch {
      close();
    }
  };

  const writeEvent = (event: RunRealtimeEvent) => {
    writeRaw(`data: ${JSON.stringify(event)}\n\n`);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
      // Initial comment establishes stream quickly without awaiting.
      writeRaw(": connected\n\n");
    },
    cancel() {
      close();
    },
  });

  const unsubscribe = subscribeRunEvents(id, (event) => {
    writeEvent(event);
  });

  const heartbeat = setInterval(() => {
    writeRaw(": keep-alive\n\n");
  }, 25000);

  request.signal.addEventListener("abort", close);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
