"use client";

import { useState } from "react";
import { createPortal, useFormStatus } from "react-dom";

import { leavePlannerAction, skipPlannerRunAction } from "./actions";

export default function PlannerControls({
  runId,
  className = "",
}: {
  runId?: number;
  className?: string;
}) {
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  return (
    <div className={`flex flex-col gap-2 sm:flex-row ${className}`}>
      <form action={skipPlannerRunAction} className="flex-1">
        {typeof runId === "number" && (
          <input type="hidden" name="runId" value={runId} />
        )}
        <SubmitButton
          pendingLabel="Skipping..."
          className="btn-ghost tap h-11 w-full rounded-full text-sm"
        >
          Skip this run
        </SubmitButton>
      </form>

      <button
        type="button"
        onClick={() => setConfirmingLeave(true)}
        className="btn-danger tap h-11 w-full rounded-full text-sm sm:flex-1"
      >
        Leave planner
      </button>

      {confirmingLeave &&
        createPortal(
          <div className="fixed inset-0 z-60 flex items-center justify-center">
            <div
              className="fixed inset-0 z-55 scrim backdrop-blur-sm"
              onClick={() => setConfirmingLeave(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="leave-planner-title"
              className="card anim-pop z-60 mx-4 w-full max-w-sm p-6"
            >
              <h2
                id="leave-planner-title"
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                Leave planner?
              </h2>
              <p className="mt-2 text-sm text-muted">
                This cancels your booked planner run and moves you to normal
                scheduling. You can set your own availability right away.
              </p>

              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmingLeave(false)}
                  className="btn-ghost tap text-sm"
                >
                  Keep planner
                </button>
                <form action={leavePlannerAction}>
                  <SubmitButton
                    pendingLabel="Leaving..."
                    className="btn-danger tap w-full text-sm sm:w-auto"
                  >
                    Leave planner
                  </SubmitButton>
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function SubmitButton({
  children,
  className,
  pendingLabel,
}: {
  children: React.ReactNode;
  className: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} disabled:cursor-default disabled:opacity-50`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
