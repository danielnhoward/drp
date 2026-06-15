"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";

import {
  COACH_PLAN,
  DIFFICULTY_OPTIONS,
  type CoachDifficulty,
} from "@/lib/coach";
import {
  cancelRunPhotoAction,
  finishRunAction,
  recordCoachFeedbackAction,
} from "./run-actions";
import RunPhotoStep from "./run-photo-step";
import RunRatingStep from "./run-rating-step";

type RatingPartner = {
  id: number;
  name: string;
  avatar: string | null;
};

type CoachResult = { graduated: boolean; nextSessionIndex: number };

export default function FinishRun({
  runId,
  partners,
  // Coached runs run the same finish flow (photo + ratings) and then add a
  // difficulty step that advances the runner's getting-started plan.
  coached = false,
}: {
  runId: number;
  partners: RatingPartner[];
  coached?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<
    "confirm" | "photo" | "rating" | "difficulty" | "result"
  >("confirm");
  const [coachResult, setCoachResult] = useState<CoachResult | null>(null);
  const [pickedDifficulty, setPickedDifficulty] =
    useState<CoachDifficulty | null>(null);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // On a coached run with no real partners, there's nobody to rate — go straight
  // to the difficulty question rather than past an empty rating screen.
  const skipRating = coached && partners.length === 0;

  function openModal() {
    // Always start at the confirmation step, even after a prior cancel.
    setStep("confirm");
    setCoachResult(null);
    setPickedDifficulty(null);
    setCoachError(null);
    setOpen(true);
  }

  // Where to go once the run is finished (and any photo handled): the rating
  // step normally, or straight to difficulty for a partnerless coached run.
  function afterFinishOrPhoto() {
    setStep(skipRating ? "difficulty" : "rating");
  }

  function confirmFinish() {
    startTransition(async () => {
      const { promptForPhoto } = await finishRunAction(runId);
      if (promptForPhoto) {
        setStep("photo");
      } else {
        afterFinishOrPhoto();
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

  // Ratings submitted: coached runs go on to the difficulty step; for an
  // ordinary partner run, finishing is done.
  function afterRating() {
    if (coached) {
      setStep("difficulty");
    } else {
      setOpen(false);
    }
  }

  function pickDifficulty(difficulty: CoachDifficulty) {
    setCoachError(null);
    setPickedDifficulty(difficulty);
    startTransition(async () => {
      const res = await recordCoachFeedbackAction(runId, difficulty);
      if ("error" in res) {
        setCoachError(res.error);
        return;
      }
      setCoachResult(res);
      setStep("result");
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

      {/* Portalled to <body> so the backdrop-filter blurs the whole page, not
          just this run card's subtree. */}
      {open &&
        createPortal(
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div
            className="fixed inset-0 z-55 scrim backdrop-blur-sm"
            // Only dismissable by backdrop on the confirm step — don't let a
            // stray tap discard the photo prompt the first finisher just earned,
            // or the coach result the runner just reached.
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
                onDone={afterFinishOrPhoto}
              />
            ) : step === "rating" ? (
              <RunRatingStep
                runId={runId}
                partners={partners}
                onComplete={afterRating}
              />
            ) : step === "difficulty" ? (
              <>
                <h2 className="text-lg font-semibold">How did that feel?</h2>
                <p className="mt-2 text-sm text-muted">
                  Your honest answer helps us pick your next run.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={pending}
                      onClick={() => pickDifficulty(option.value)}
                      className="tap flex flex-col items-start rounded-lg border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-accent/40 disabled:opacity-50"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {option.label}
                      </span>
                      <span className="text-xs text-muted">{option.hint}</span>
                    </button>
                  ))}
                </div>
                {coachError && (
                  <p className="mt-4 text-sm text-danger">{coachError}</p>
                )}
              </>
            ) : coachResult?.graduated ? (
              <>
                <h2 className="text-gradient text-xl font-semibold tracking-tight">
                  You&apos;re all set! 🎉
                </h2>
                <p className="mt-2 text-sm text-muted">
                  You&apos;ve got a feel for pace and distance and how the app
                  works — nice going. We&apos;ve set a comfortable pace for you
                  (you can fine-tune it in your profile any time).
                </p>
                <p className="mt-2 text-sm text-muted">
                  From here you&apos;re a regular runner: set your own schedule
                  and we&apos;ll match you with partners.
                </p>
                <div className="mt-4 flex justify-end">
                  {/* Full-page nav so the bottom tab flips Coach → Schedule and
                      every route picks up the graduated state. */}
                  <button
                    type="button"
                    onClick={() => window.location.assign("/schedule")}
                    className="btn-accent text-sm"
                  >
                    Explore the schedule
                  </button>
                </div>
              </>
            ) : pickedDifficulty === "tough" ? (
              <>
                <h2 className="text-lg font-semibold">That was a tough one 💪</h2>
                <p className="mt-2 text-sm text-muted">
                  No shame in that — plenty of runners need a couple of goes at a
                  session before it clicks. We&apos;ll run this same one again so
                  it feels easier next time. Rest up first.
                </p>
                <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3">
                  <p className="text-sm font-medium text-foreground">
                    {COACH_PLAN[coachResult?.nextSessionIndex ?? 0]?.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    about{" "}
                    <span className="font-mono tnum">
                      {COACH_PLAN[coachResult?.nextSessionIndex ?? 0]?.distanceKm}
                    </span>{" "}
                    km · again
                  </p>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => window.location.assign("/plan")}
                    className="btn-accent text-sm"
                  >
                    Open planner
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Nice work! 👏</h2>
                <p className="mt-2 text-sm text-muted">
                  That one&apos;s in the bag. Here&apos;s what&apos;s next in your
                  planner:
                </p>
                <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3">
                  <p className="text-sm font-medium text-foreground">
                    {COACH_PLAN[coachResult?.nextSessionIndex ?? 0]?.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    about{" "}
                    <span className="font-mono tnum">
                      {COACH_PLAN[coachResult?.nextSessionIndex ?? 0]?.distanceKm}
                    </span>{" "}
                    km
                  </p>
                </div>
                <div className="mt-4 flex justify-end">
                  {/* Full-page nav so /plan re-renders with the next session and
                      home drops this finished run, with no revalidation needed. */}
                  <button
                    type="button"
                    onClick={() => window.location.assign("/plan")}
                    className="btn-accent text-sm"
                  >
                    Open planner
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}
