"use client";

import { useActionState, useState } from "react";

import { GENDERS, GENDER_LABELS, type Gender } from "@/lib/gender";
import { formatMMSS } from "@/lib/profile-fields";
import { updateProfileAction, type ProfileFormState } from "./actions";
import {
  appendSuggestion,
  MAX_VIBE_LENGTH,
  PACE_PRESETS,
  VIBE_PROMPTS,
  type VibeFieldName,
  type VibePrompt,
} from "./profile-content";

type Props = {
  initialName: string;
  initialDateOfBirth: string;
  // "" only appears as a fallback when the stored value isn't a known Gender
  // - the <select> is `required` so submission still forces a real choice.
  initialGender: Gender | "";
  /** Comfortable pace in seconds per km, or null when not set (it's optional). */
  initialPreferredPaceSeconds: number | null;
  /** Optional "about me" free text - null when unset. */
  initialWhyRun: string | null;
  initialHobbies: string | null;
  initialInterests: string | null;
};

const INITIAL_STATE: ProfileFormState = {};

// The meter starts here and climbs 10% for each filled optional field (the three
// vibe prompts plus the conversational 5k time), so all four filled reaches 100%.
const BASE_PROFILE_PERCENT = 60;

const fieldClass =
  "h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent";

const textareaClass =
  "mt-3 min-h-24 w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent";

export default function ProfileForm({
  initialName,
  initialDateOfBirth,
  initialGender,
  initialPreferredPaceSeconds,
  initialWhyRun,
  initialHobbies,
  initialInterests,
}: Props) {
  const [state, action, pending] = useActionState(
    updateProfileAction,
    INITIAL_STATE,
  );
  const [vibe, setVibe] = useState<Record<VibeFieldName, string>>({
    whyRun: initialWhyRun ?? "",
    hobbies: initialHobbies ?? "",
    interests: initialInterests ?? "",
  });

  // Convert stored pace (seconds/km) back to a 5k time for the input, since
  // the form collects 5k time to match the availability flow. Pace is optional,
  // so leave the field blank when it's unset.
  const initialFiveK =
    initialPreferredPaceSeconds !== null
      ? formatMMSS(initialPreferredPaceSeconds * 5)
      : "";
  const [fiveK, setFiveK] = useState(initialFiveK);
  // Optional fields that drive the completion meter: the three vibe prompts plus
  // the conversational 5k time.
  const optionalFieldCount = VIBE_PROMPTS.length + 1;
  const filledVibeCount = VIBE_PROMPTS.filter((prompt) =>
    vibe[prompt.name].trim(),
  ).length;
  const filledOptionalCount = filledVibeCount + (fiveK.trim() ? 1 : 0);
  const remainingOptionalCount = optionalFieldCount - filledOptionalCount;
  const profilePercent = BASE_PROFILE_PERCENT + filledOptionalCount * 10;
  const isVibeComplete = remainingOptionalCount === 0;

  function updateVibe(name: VibeFieldName, value: string) {
    setVibe((current) => ({
      ...current,
      [name]: value.slice(0, MAX_VIBE_LENGTH),
    }));
  }

  function addSuggestion(name: VibeFieldName, suggestion: string) {
    setVibe((current) => ({
      ...current,
      [name]: appendSuggestion(current[name], suggestion, MAX_VIBE_LENGTH),
    }));
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Name">
        <input
          className={fieldClass}
          type="text"
          name="name"
          required
          autoComplete="name"
          defaultValue={initialName}
        />
      </Field>

      <Field label="Date of birth">
        <input
          className={fieldClass}
          type="date"
          name="dateOfBirth"
          required
          defaultValue={initialDateOfBirth}
          max={new Date().toISOString().slice(0, 10)}
        />
      </Field>

      <Field label="Gender">
        <select
          className={fieldClass}
          name="gender"
          required
          defaultValue={initialGender}
        >
          <option value="" disabled>
            Select...
          </option>
          {GENDERS.map((g) => (
            <option key={g} value={g}>
              {GENDER_LABELS[g]}
            </option>
          ))}
        </select>
      </Field>

      <section
        id="running-vibe"
        aria-labelledby="running-vibe-title"
        className="mt-2 flex scroll-mt-24 flex-col gap-3 border-t border-border pt-5"
      >
        <div
          className={`rounded-lg border p-4 ${
            isVibeComplete
              ? "border-success/40 bg-success/10"
              : "border-accent/40 bg-accent/10"
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isVibeComplete
                  ? "bg-success/15 text-success"
                  : "bg-accent/15 text-accent"
              }`}
            >
              <MeterIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <h2
                  id="running-vibe-title"
                  className="text-base font-semibold text-foreground"
                >
                  Your running vibe
                </h2>
                <span className="text-sm font-semibold text-foreground">
                  <span className="font-mono tnum">{profilePercent}%</span>
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${
                    isVibeComplete ? "bg-success" : "bg-accent"
                  }`}
                  style={{ width: `${profilePercent}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-muted">
                {isVibeComplete
                  ? "Nice. Partners will see your easy pace and a little personality before a run."
                  : remainingOptionalCount === 1
                    ? "One more quick detail finishes what partners read before a run."
                    : `Add ${remainingOptionalCount} quick details partners read before a run.`}
              </p>
            </div>
          </div>
        </div>

        <PaceCard value={fiveK} pending={pending} onChange={setFiveK} />

        {VIBE_PROMPTS.map((prompt) => (
          <VibePromptCard
            key={prompt.name}
            prompt={prompt}
            value={vibe[prompt.name]}
            pending={pending}
            onChange={updateVibe}
            onSuggestion={addSuggestion}
          />
        ))}

        <PartnerPreview prompts={VIBE_PROMPTS} values={vibe} />
      </section>

      {state.error && (
        <p className="text-sm text-danger">{state.error}</p>
      )}
      {state.ok && !state.error && (
        <p className="text-sm text-success">Saved.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 flex h-11 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-contrast tap transition-colors hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}

function PaceCard({
  value,
  pending,
  onChange,
}: {
  value: string;
  pending: boolean;
  onChange: (value: string) => void;
}) {
  const filled = Boolean(value.trim());

  return (
    <section
      className={`rounded-lg border p-4 bg-surface ${
        filled ? "border-success/40" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <StopwatchIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <label
              htmlFor="fiveKTime"
              className="text-sm font-semibold text-foreground"
            >
              Your conversational 5k time
            </label>
            {filled && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                <CheckIcon className="h-3.5 w-3.5" />
                Added
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            The time you&apos;d run 5k while chatting the whole way - relaxed, not
            a race.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PACE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={pending}
            onClick={() => onChange(preset)}
            className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-left text-xs font-medium text-muted tap transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent disabled:opacity-50"
          >
            <PlusIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-mono tnum">{preset}</span>
          </button>
        ))}
      </div>

      <input
        id="fiveKTime"
        className={`${fieldClass} mt-3 w-full`}
        type="text"
        name="fiveKTime"
        placeholder="22:30"
        pattern="\d{1,2}:[0-5]\d"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />

      <p className="mt-2 text-xs text-muted">
        {filled
          ? "Partners see this as your easy, chatty pace."
          : "Tap a time or type your own as mm:ss."}
      </p>
    </section>
  );
}

function VibePromptCard({
  prompt,
  value,
  pending,
  onChange,
  onSuggestion,
}: {
  prompt: VibePrompt;
  value: string;
  pending: boolean;
  onChange: (name: VibeFieldName, value: string) => void;
  onSuggestion: (name: VibeFieldName, suggestion: string) => void;
}) {
  const filled = Boolean(value.trim());
  const Icon = prompt.Icon;

  return (
    <section
      className={`rounded-lg border p-4 bg-surface ${
        filled ? "border-success/40" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <label
              htmlFor={prompt.name}
              className="text-sm font-semibold text-foreground"
            >
              {prompt.title}
            </label>
            {filled && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                <CheckIcon className="h-3.5 w-3.5" />
                Added
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {prompt.microcopy}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {prompt.suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={pending}
            onClick={() => onSuggestion(prompt.name, suggestion)}
            className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-left text-xs font-medium text-muted tap transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent disabled:opacity-50"
          >
            <PlusIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{suggestion}</span>
          </button>
        ))}
      </div>

      <textarea
        id={prompt.name}
        className={textareaClass}
        name={prompt.name}
        rows={3}
        maxLength={MAX_VIBE_LENGTH}
        placeholder={prompt.placeholder}
        value={value}
        onChange={(event) => onChange(prompt.name, event.target.value)}
      />

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
        <span>
          {filled
            ? "This now appears in your partner preview."
            : "Pick a chip or write it your way."}
        </span>
        <span className="shrink-0 font-mono tnum">
          {value.length}/{MAX_VIBE_LENGTH}
        </span>
      </div>
    </section>
  );
}

function PartnerPreview({
  prompts,
  values,
}: {
  prompts: VibePrompt[];
  values: Record<VibeFieldName, string>;
}) {
  const previewItems = prompts
    .map((prompt) => ({
      label: prompt.previewLabel,
      value: values[prompt.name].trim(),
    }))
    .filter((item) => item.value);

  return (
    <section className="rounded-lg border border-border bg-surface-2 p-4">
      <div className="flex items-center gap-2">
        <EyeIcon className="h-4 w-4 text-muted" />
        <h3 className="text-sm font-semibold text-foreground">
          Partner preview
        </h3>
      </div>

      {previewItems.length > 0 ? (
        <dl className="mt-3 flex flex-col gap-3">
          {previewItems.map((item) => (
            <div key={item.label}>
              <dt className="text-xs font-medium uppercase text-muted">
                {item.label}
              </dt>
              <dd className="mt-0.5 whitespace-pre-line text-sm text-foreground">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Add one prompt and this turns into the short intro another runner sees.
        </p>
      )}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-muted">
        {label}
      </span>
      {hint && (
        <span className="text-sm font-normal text-muted">
          {hint}
        </span>
      )}
      {children}
    </label>
  );
}

function StopwatchIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="14" r="7" />
      <path d="M12 14V10" />
      <path d="M9 2h6" />
      <path d="M12 2v2" />
      <path d="M18.4 7.6l1-1" />
    </svg>
  );
}

function MeterIcon({ className }: { className?: string }) {
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
      <path d="M4 14a8 8 0 1 1 16 0" />
      <path d="M12 14l4-4" />
      <path d="M8 18h8" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
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
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
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
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
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
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
