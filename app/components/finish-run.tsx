"use client";

import { useState } from "react";
import { finishRunAction } from "./run-actions";

export default function FinishRun({ runId }: { runId: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
      >
        Finish run
      </button>

      {open && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div className="fixed inset-0 z-55 bg-black/40" onClick={() => setOpen(false)} />
          <div className="z-60 mx-4 max-w-lg rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Finish run</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Confirm you want to finish this run.
            </p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 bg-zinc-100 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Cancel
              </button>

              <form action={finishRunAction}>
                <input type="hidden" name="runId" value={String(runId)} />
                <button
                  type="submit"
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
                >
                  Confirm finish
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
