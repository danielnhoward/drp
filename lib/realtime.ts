import "server-only";

export type RunRealtimeEvent = {
  type: "run.message.updated";
  runId: number;
  userId: number;
  message: string;
};

type Listener = (event: RunRealtimeEvent) => void;

type RealtimeState = {
  channels: Map<string, Set<Listener>>;
};

declare global {
  // eslint-disable-next-line no-var
  var __runRealtimeState__: RealtimeState | undefined;
}

const state: RealtimeState = globalThis.__runRealtimeState__ ?? {
  channels: new Map(),
};

if (process.env.NODE_ENV !== "production") {
  globalThis.__runRealtimeState__ = state;
}

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
  message: string,
): void {
  publish(channelForRun(runId), {
    type: "run.message.updated",
    runId,
    userId,
    message,
  });
}
