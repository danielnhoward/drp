"use client";

import { useActionState } from "react";
import { useEffect, useState } from "react";

import { addRunMessageAction, clearRunMessageAction, type RunMessageState } from "./run-actions";

const INITIAL_STATE: RunMessageState = {};
const textareaClass =
  "min-h-20 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent";

export default function RunMessageForm({
  runId,
  initialMessage,
}: {
  runId: number;
  initialMessage: string | null;
}) {
  const [state, action, pending] = useActionState(
    addRunMessageAction,
    INITIAL_STATE,
  );
  const [clearState, clearAction, clearPending] = useActionState(
    clearRunMessageAction,
    INITIAL_STATE,
  );

  const savedMessage = state.ok ? state.message ?? initialMessage : initialMessage;
  const [editing, setEditing] = useState<boolean>(savedMessage === null);

  // Close editor when save completes. Depend on the whole `state` object rather
  // than `state.ok`: useActionState returns a fresh object on every submission,
  // so this re-runs after each save. Depending on `state.ok` would only fire on
  // the first save (false -> true) and silently no-op on subsequent saves, since
  // the boolean stays `true` and the dependency never changes.
  useEffect(() => {
    if (state.ok) {
      // schedule state update to avoid synchronous setState within effect
      setTimeout(() => setEditing(false));
    }
  }, [state]);

  // Close editor when clear completes
  useEffect(() => {
    if (clearState.ok) {
      setTimeout(() => setEditing(false));
    }
  }, [clearState]);

  if (!editing && savedMessage !== null) {
    return (
      <div className="rounded-2xl border border-border bg-surface-2 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Your message
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-foreground">
              {savedMessage}
            </p>
          </div>
          <div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 cursor-pointer"
              >
                Edit
              </button>
              <form action={clearAction} className="inline">
                <input type="hidden" name="runId" value={runId} />
                <button
                  type="submit"
                  disabled={clearPending}
                  className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 cursor-pointer"
                >
                  {clearPending ? "Clearing…" : "Clear"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <form
        action={action}
        className="rounded-2xl border border-dashed border-border bg-surface-2/50 p-3"
      >
        <input type="hidden" name="runId" value={runId} />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            {savedMessage ? "Edit your message" : "Add a message"}
          </span>
          <textarea
            name="message"
            maxLength={500}
            rows={3}
            defaultValue={savedMessage ?? undefined}
            placeholder="e.g. I’ll be the one in the blue jacket and I’m happy to chat about trail running."
            className={textareaClass}
            disabled={pending}
          />
        </label>

        {state.error && (
          <p className="mt-2 text-sm text-danger">{state.error}</p>
        )}

        <div className="mt-3 flex justify-end gap-2">
          {savedMessage && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
              }}
              className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast transition hover:brightness-110 disabled:opacity-60 cursor-pointer"
          >
            {pending ? "Saving…" : "Save message"}
          </button>
        </div>
      </form>

      {savedMessage && (
        <form action={clearAction} className="mt-2 flex justify-end">
          <input type="hidden" name="runId" value={runId} />
          <button
            type="submit"
            disabled={clearPending}
            className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 cursor-pointer"
          >
            {clearPending ? "Clearing…" : "Clear message"}
          </button>
        </form>
      )}
    </div>
  );
}
