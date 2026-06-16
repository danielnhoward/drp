"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";

import {
  submitRunRatingsAction,
  type RunRatingsState,
} from "./run-actions";

type RatingPartner = {
  id: number;
  name: string;
  avatar: string | null;
};

type Props = {
  runId: number;
  partners: RatingPartner[];
  onComplete: () => void;
};

const INITIAL_STATE: RunRatingsState = {};

export default function RunRatingStep({ runId, partners, onComplete }: Props) {
  const [state, action, pending] = useActionState(
    submitRunRatingsAction,
    INITIAL_STATE,
  );
  const [scores, setScores] = useState<Record<number, 1 | 5>>({});

  useEffect(() => {
    if (state.ok) onComplete();
  }, [state.ok, onComplete]);

  const ready =
    partners.length === 0 ||
    partners.every((partner) => scores[partner.id] !== undefined);

  return (
    <>
      <h2 className="text-lg font-semibold text-foreground">Rate your run partners</h2>
      <p className="mt-2 text-sm text-muted">
        Your rating rolls into their trust score for future matches.
      </p>

      <form action={action} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="runId" value={String(runId)} />

        {partners.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
            No partners to rate for this run.
          </p>
        ) : (
          partners.map((partner) => (
            <section
              key={partner.id}
              className="rounded-xl border border-border p-3"
            >
              <div className="flex items-center gap-3">
                <PartnerAvatar partner={partner} />
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-foreground">{partner.name}</h3>
                </div>
              </div>

              <input
                type="hidden"
                name={`rating-${partner.id}`}
                value={scores[partner.id] ?? ""}
              />
              <div
                className="mt-3 flex gap-3"
                role="group"
                aria-label={`Rating for ${partner.name}`}
              >
                <button
                  type="button"
                  aria-label={`Thumbs up for ${partner.name}`}
                  aria-pressed={scores[partner.id] === 5}
                  disabled={pending}
                  onClick={() => setScores((c) => ({ ...c, [partner.id]: 5 }))}
                  className={`tap flex h-11 w-11 items-center justify-center rounded-xl border transition-colors disabled:opacity-50 ${
                    scores[partner.id] === 5
                      ? "border-green-500/40 bg-green-500/10 text-green-500"
                      : "border-border text-muted hover:bg-surface-2 hover:text-green-500"
                  }`}
                >
                  <ThumbIcon direction="up" />
                </button>
                <button
                  type="button"
                  aria-label={`Thumbs down for ${partner.name}`}
                  aria-pressed={scores[partner.id] === 1}
                  disabled={pending}
                  onClick={() => setScores((c) => ({ ...c, [partner.id]: 1 }))}
                  className={`tap flex h-11 w-11 items-center justify-center rounded-xl border transition-colors disabled:opacity-50 ${
                    scores[partner.id] === 1
                      ? "border-danger/40 bg-danger/10 text-danger"
                      : "border-border text-muted hover:bg-surface-2 hover:text-danger"
                  }`}
                >
                  <ThumbIcon direction="down" />
                </button>
              </div>
            </section>
          ))
        )}

        {state.error && (
          <p className="text-sm text-danger" aria-live="polite">
            {state.error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!ready || pending}
            className="btn-accent tap text-sm disabled:opacity-50"
          >
            {pending ? "Saving..." : "Submit ratings"}
          </button>
        </div>
      </form>
    </>
  );
}

function PartnerAvatar({ partner }: { partner: RatingPartner }) {
  if (partner.avatar) {
    return (
      <Image
        src={partner.avatar}
        alt={`${partner.name}'s profile picture`}
        width={44}
        height={44}
        className="h-11 w-11 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 font-semibold text-muted"
    >
      {partner.name.charAt(0)}
    </span>
  );
}

function ThumbIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-5 w-5 ${direction === "down" ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
}
