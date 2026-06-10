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
const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export default function RunRatingStep({ runId, partners, onComplete }: Props) {
  const [state, action, pending] = useActionState(
    submitRunRatingsAction,
    INITIAL_STATE,
  );
  const [scores, setScores] = useState<Record<number, number>>({});

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
        Your stars roll into their trust score for future matches.
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
                className="mt-3 flex gap-1"
                role="group"
                aria-label={`Rating for ${partner.name}`}
              >
                {STAR_VALUES.map((value) => {
                  const selected = (scores[partner.id] ?? 0) >= value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-label={`${value} star rating for ${partner.name}`}
                      aria-pressed={selected}
                      disabled={pending}
                      onClick={() =>
                        setScores((current) => ({
                          ...current,
                          [partner.id]: value,
                        }))
                      }
                      className={`tap flex h-10 w-10 items-center justify-center rounded-lg border transition-colors disabled:opacity-50 ${
                        selected
                          ? "border-accent/40 bg-accent/10 text-accent"
                          : "border-border text-muted hover:bg-surface-2 hover:text-accent"
                      }`}
                    >
                      <StarIcon filled={selected} />
                    </button>
                  );
                })}
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

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
    >
      <path d="m12 3.2 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9L6.6 20l1-6.1-4.4-4.3 6.1-.9L12 3.2Z" />
    </svg>
  );
}
