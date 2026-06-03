"use client";

import { useActionState } from "react";
import { useEffect, useState } from "react";

import { addRunMessageAction, type RunMessageState } from "./run-actions";

const INITIAL_STATE: RunMessageState = {};
const textareaClass =
  "min-h-20 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white/50";

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

  const savedMessage = state.ok ? state.message ?? initialMessage : initialMessage;
  const [editing, setEditing] = useState<boolean>(savedMessage === null);

  // Close editor when save completes
  useEffect(() => {
    if (state.ok) {
      // schedule state update to avoid synchronous setState within effect
      setTimeout(() => setEditing(false));
    }
  }, [state.ok]);

  if (!editing && savedMessage !== null) {
    return (
      <div className="rounded-2xl border border-black/10 bg-zinc-50 p-3 dark:border-white/15 dark:bg-zinc-950/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Your message
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
              {savedMessage}
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-full border px-3 py-1.5 text-sm font-medium cursor-pointer"
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="rounded-2xl border border-dashed border-black/15 bg-zinc-50/60 p-3 dark:border-white/15 dark:bg-zinc-950/30"
    >
      <input type="hidden" name="runId" value={runId} />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
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
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-2">
        {savedMessage && (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
            }}
            className="rounded-full border px-3 py-1.5 text-sm font-medium cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-60 cursor-pointer"
        >
          {pending ? "Saving…" : "Save message"}
        </button>
      </div>
    </form>
  );
}
