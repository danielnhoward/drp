"use client";

import { useState, useTransition } from "react";

import { cancelRunPhotoAction, finishRunAction } from "./run-actions";
import RunPhotoStep from "./run-photo-step";
import RunRatingStep from "./run-rating-step";

type RatingPartner = {
  id: number;
  name: string;
  avatar: string | null;
};

export default function FinishRun({
  runId,
  partners,
}: {
  runId: number;
  partners: RatingPartner[];
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"confirm" | "photo" | "rating">("confirm");
  const [pending, startTransition] = useTransition();

  function openModal() {
    // Always start at the confirmation step, even after a prior cancel.
    setStep("confirm");
    setOpen(true);
  }

  function confirmFinish() {
    startTransition(async () => {
      const { promptForPhoto } = await finishRunAction(runId);
      if (promptForPhoto) {
        setStep("photo");
      } else {
        setStep("rating");
      }
    });
  }

  // Photographer declined: revert their finish so the run stays on their home
  // page and the next person to finish is asked for the photo.
  function cancelPhoto() {
    setOpen(false);
    startTransition(async () => {
      await cancelRunPhotoAction(runId);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={openModal}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast tap transition hover:brightness-110"
      >
        Finish run
      </button>

      {open && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div
            className="fixed inset-0 z-55 scrim backdrop-blur-sm"
            // Only dismissable by backdrop on the confirm step — don't let a
            // stray tap discard the photo prompt the first finisher just earned.
            onClick={step === "confirm" ? () => setOpen(false) : undefined}
          />
          <div className="card anim-pop z-60 mx-4 w-full max-w-lg p-6">
            {step === "confirm" ? (
              <>
                <h2 className="text-lg font-semibold">Finish run</h2>
                <p className="mt-2 text-sm text-muted">
                  Confirm you want to finish this run.
                </p>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="btn-ghost text-sm"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={confirmFinish}
                    disabled={pending}
                    className="btn-accent text-sm"
                  >
                    {pending ? "Finishing…" : "Confirm finish"}
                  </button>
                </div>
              </>
            ) : step === "photo" ? (
              <RunPhotoStep
                runId={runId}
                onCancel={cancelPhoto}
                onDone={() => setStep("rating")}
              />
            ) : (
              <RunRatingStep
                runId={runId}
                partners={partners}
                onComplete={() => setOpen(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
