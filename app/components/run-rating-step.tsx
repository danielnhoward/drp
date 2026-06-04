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
      <h2 className="text-lg font-semibold">Rate your run partners</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Your stars roll into their trust score for future matches. Notes stay
        private for now.
      </p>

      <form action={action} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="runId" value={String(runId)} />

        {partners.length === 0 ? (
          <p className="rounded-lg border border-black/10 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-300">
            No partners to rate for this run.
          </p>
        ) : (
          partners.map((partner) => (
            <section
              key={partner.id}
              className="rounded-xl border border-black/10 p-3 dark:border-white/15"
            >
              <div className="flex items-center gap-3">
                <PartnerAvatar partner={partner} />
                <div className="min-w-0">
                  <h3 className="truncate font-medium">{partner.name}</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    How did this run feel?
                  </p>
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
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors disabled:opacity-50 ${
                        selected
                          ? "border-amber-300 bg-amber-100 text-amber-600 dark:border-amber-400/70 dark:bg-amber-400/15 dark:text-amber-300"
                          : "border-black/10 text-zinc-300 hover:bg-zinc-50 hover:text-amber-500 dark:border-white/15 dark:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-amber-300"
                      }`}
                    >
                      <StarIcon filled={selected} />
                    </button>
                  );
                })}
              </div>

              <label className="mt-3 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Private note
                <textarea
                  name={`note-${partner.id}`}
                  rows={2}
                  maxLength={280}
                  disabled={pending}
                  placeholder="Reliable, friendly, steady pace..."
                  className="mt-1 w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </label>
            </section>
          ))
        )}

        {state.error && (
          <p className="text-sm text-red-600 dark:text-red-400" aria-live="polite">
            {state.error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!ready || pending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
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
        className="h-11 w-11 shrink-0 rounded-full border border-black/10 object-cover dark:border-white/15"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-zinc-100 font-semibold text-zinc-500 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-400"
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
