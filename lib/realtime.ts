import "server-only";

export type RunRealtimeEvent = {
  type: "run.message.updated";
  runId: number;
  userId: number;
  message: string | null;
};

type Listener = (event: RunRealtimeEvent) => void;

type RealtimeState = {
  channels: Map<string, Set<Listener>>;
};

declare global {
  var __runRealtimeState__: RealtimeState | undefined;
}

// Pin the realtime state to globalThis so every bundled copy of this module
// shares it. Next.js can bundle `lib/realtime.ts` separately into the Server
// Action chunk (the publisher) and the Route Handler chunk (the SSE
// subscriber); without a shared singleton each copy gets its own `channels`
// map and the listener never hears the publisher. This must run in production
// too — unlike the Prisma dev-only pattern, the duplication we're guarding
// against happens in the production build, not just across HMR reloads.
const state: RealtimeState = (globalThis.__runRealtimeState__ ??= {
  channels: new Map(),
});

function channelForRun(runId: number): string {
  return `run:${runId}`;
}

function subscribe(channel: string, listener: Listener): () => void {
  let listeners = state.channels.get(channel);
  if (!listeners) {
    listeners = new Set();
    state.channels.set(channel, listeners);
  }
  listeners.add(listener);

  return () => {
    const existing = state.channels.get(channel);
    if (!existing) return;
    existing.delete(listener);
    if (existing.size === 0) state.channels.delete(channel);
  };
}

function publish(channel: string, event: RunRealtimeEvent): void {
  const listeners = state.channels.get(channel);
  if (!listeners) return;

  for (const listener of listeners) {
    listener(event);
  }
}

export function subscribeRunEvents(
  runId: number,
  listener: Listener,
): () => void {
  return subscribe(channelForRun(runId), listener);
}

export function publishRunMessageUpdated(
  runId: number,
  userId: number,
  message: string | null,
): void {
  publish(channelForRun(runId), {
    type: "run.message.updated",
    runId,
    userId,
    message,
  });
}
