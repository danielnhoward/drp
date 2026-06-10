"use client";

import { useActionState, useState } from "react";

import {
  isPronounOption,
  MAX_PRONOUNS_LENGTH,
  PRONOUN_OPTIONS,
} from "@/lib/pronouns";
import { updatePronounsAction, type PronounsFormState } from "./actions";

type Props = {
  initialPronouns: string | null;
};

const INITIAL_STATE: PronounsFormState = {};

const inputClass =
  "h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent";

export default function PronounsForm({ initialPronouns }: Props) {
  const [state, action, pending] = useActionState(
    updatePronounsAction,
    INITIAL_STATE,
  );
  const [pronouns, setPronouns] = useState(initialPronouns ?? "");
  const [pronounsMode, setPronounsMode] = useState<"preset" | "other">(
    initialPronouns?.trim() && !isPronounOption(initialPronouns)
      ? "other"
      : "preset",
  );
  const trimmed = pronouns.trim();
  const showOtherPronouns =
    pronounsMode === "other" ||
    Boolean(trimmed && !isPronounOption(pronouns));

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="pronouns" value={pronouns} />

      <section className="card px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <PronounsIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">
              Pronouns
            </h2>
            <p className="mt-1 text-sm text-muted">
              Add the words you want matched runners to use for you.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {PRONOUN_OPTIONS.map((option) => {
            const selected =
              pronounsMode !== "other" && trimmed.toLowerCase() === option;
            return (
              <button
                key={option}
                type="button"
                disabled={pending}
                aria-pressed={selected}
                onClick={() => {
                  setPronounsMode("preset");
                  setPronouns(option);
                }}
                className={`tap flex h-12 items-center rounded-lg border px-4 text-left text-sm font-medium transition-colors disabled:opacity-50 ${
                  selected
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border bg-surface text-foreground hover:border-accent/40"
                }`}
              >
                {option}
              </button>
            );
          })}
          <button
            type="button"
            disabled={pending}
            aria-pressed={showOtherPronouns}
            onClick={() => {
              setPronounsMode("other");
              if (isPronounOption(pronouns)) setPronouns("");
            }}
            className={`tap flex h-12 items-center rounded-lg border px-4 text-left text-sm font-medium transition-colors disabled:opacity-50 ${
              showOtherPronouns
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border bg-surface text-foreground hover:border-accent/40"
            }`}
          >
            Other
          </button>
        </div>

        {showOtherPronouns && (
          <input
            id="pronouns"
            className={`${inputClass} mt-4 w-full`}
            type="text"
            autoComplete="off"
            aria-label="Pronouns"
            autoFocus
            maxLength={MAX_PRONOUNS_LENGTH}
            value={pronouns}
            onChange={(event) => setPronouns(event.target.value)}
          />
        )}

        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
          <button
            type="button"
            disabled={pending || !pronouns}
            onClick={() => setPronouns("")}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
          >
            <XIcon className="h-3.5 w-3.5" />
            Clear
          </button>
          <span className="shrink-0 font-mono tnum">
            {pronouns.length}/{MAX_PRONOUNS_LENGTH}
          </span>
        </div>
      </section>

      {state.error && (
        <p className="text-sm text-danger" aria-live="polite">
          {state.error}
        </p>
      )}
      {state.ok && !state.error && (
        <p className="text-sm text-success" aria-live="polite">
          Saved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-contrast tap transition-colors hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save pronouns"}
      </button>
    </form>
  );
}

function PronounsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7 7h10" />
      <path d="M7 12h6" />
      <path d="M5 20l3-4h9a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h1" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}
