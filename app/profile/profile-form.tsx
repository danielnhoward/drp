"use client";

import { useActionState, useState } from "react";

import { GENDERS, GENDER_LABELS, type Gender } from "@/lib/gender";
import { updateProfileAction, type ProfileFormState } from "./actions";

type Props = {
  initialName: string;
  initialDateOfBirth: string;
  // "" only appears as a fallback when the stored value isn't a known Gender
  // - the <select> is `required` so submission still forces a real choice.
  initialGender: Gender | "";
  /** Comfortable pace in seconds per km. */
  initialPreferredPaceSeconds: number;
  /** Optional "about me" free text - null when unset. */
  initialWhyRun: string | null;
  initialHobbies: string | null;
  initialInterests: string | null;
};

type VibeFieldName = "whyRun" | "hobbies" | "interests";

type VibePrompt = {
  name: VibeFieldName;
  title: string;
  microcopy: string;
  placeholder: string;
  previewLabel: string;
  suggestions: string[];
  Icon: (props: { className?: string }) => React.ReactNode;
};

const INITIAL_STATE: ProfileFormState = {};

const MAX_VIBE_LENGTH = 500;
const BASE_PROFILE_PERCENT = 70;

const fieldClass =
  "h-10 rounded-lg border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-black/40 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white/50";

const textareaClass =
  "mt-3 min-h-24 w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white/50";

const VIBE_PROMPTS: VibePrompt[] = [
  {
    name: "whyRun",
    title: "What makes your runs better?",
    microcopy:
      "Tell your future running partner what makes your runs feel easy and enjoyable.",
    placeholder:
      "e.g. I like easy miles with good chat, especially when someone gets me out the door.",
    previewLabel: "Runs feel better when",
    suggestions: [
      "Easy miles with good chat",
      "Accountability when motivation dips",
      "Finding new local routes",
    ],
    Icon: SparkIcon,
  },
  {
    name: "hobbies",
    title: "What are you into lately, apart from running?",
    microcopy:
      "A couple of current interests makes the pre-run hello less awkward.",
    placeholder:
      "e.g. Trying new coffee spots, cooking after long runs, and learning guitar badly but happily.",
    previewLabel: "Off-run lately",
    suggestions: ["Coffee spots", "Cooking", "Live music", "Weekend walks"],
    Icon: TrailIcon,
  },
  {
    name: "interests",
    title: "What could you happily chat about on an easy run?",
    microcopy:
      "Think low-pressure topics for the moments between pace checks.",
    placeholder:
      "e.g. Films, travel stories, football, local food places, or whatever podcast I just got hooked on.",
    previewLabel: "Easy-run chat",
    suggestions: ["Films and TV", "Travel stories", "Food places", "Podcasts"],
    Icon: ChatIcon,
  },
];

function formatMMSS(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

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
  // the form collects 5k time to match the availability flow.
  const initialFiveK = formatMMSS(initialPreferredPaceSeconds * 5);
  const filledVibeCount = VIBE_PROMPTS.filter((prompt) =>
    vibe[prompt.name].trim(),
  ).length;
  const remainingVibeCount = VIBE_PROMPTS.length - filledVibeCount;
  const profilePercent = BASE_PROFILE_PERCENT + filledVibeCount * 10;
  const isVibeComplete = remainingVibeCount === 0;

  function updateVibe(name: VibeFieldName, value: string) {
    setVibe((current) => ({
      ...current,
      [name]: value.slice(0, MAX_VIBE_LENGTH),
    }));
  }

  function addSuggestion(name: VibeFieldName, suggestion: string) {
    setVibe((current) => {
      const currentValue = current[name].trim();
      if (
        currentValue.toLowerCase().includes(suggestion.toLowerCase())
      ) {
        return current;
      }

      const joiner = currentValue
        ? /[.!?]$/.test(currentValue)
          ? " "
          : ", "
        : "";

      return {
        ...current,
        [name]: `${currentValue}${joiner}${suggestion}`.slice(
          0,
          MAX_VIBE_LENGTH,
        ),
      };
    });
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

      <Field label="Comfortable 5k time (mm:ss)">
        <input
          className={fieldClass}
          type="text"
          name="fiveKTime"
          required
          placeholder="22:30"
          pattern="\d{1,2}:[0-5]\d"
          defaultValue={initialFiveK}
        />
      </Field>

      <section
        id="running-vibe"
        aria-labelledby="running-vibe-title"
        className="mt-2 flex scroll-mt-24 flex-col gap-3 border-t border-black/10 pt-5 dark:border-white/15"
      >
        <div
          className={`rounded-lg border p-4 ${
            isVibeComplete
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30"
              : "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/25"
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isVibeComplete
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
              }`}
            >
              <MeterIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <h2
                  id="running-vibe-title"
                  className="text-base font-semibold text-zinc-950 dark:text-zinc-50"
                >
                  Your running vibe
                </h2>
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  {profilePercent}%
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80 dark:bg-zinc-950/50">
                <div
                  className={`h-full rounded-full ${
                    isVibeComplete ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${profilePercent}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                {isVibeComplete
                  ? "Nice. Partners will see a little personality alongside your pace and schedule."
                  : remainingVibeCount === 1
                    ? "One more quick prompt finishes the intro partners read before a run."
                    : `Add ${remainingVibeCount} quick details for run partners read before a run.`}
              </p>
            </div>
          </div>
        </div>

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
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state.ok && !state.error && (
        <p className="text-sm text-green-700 dark:text-green-400">Saved.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 flex h-11 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save profile"}
      </button>
    </form>
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
      className={`rounded-lg border p-4 ${
        filled
          ? "border-emerald-200 bg-white dark:border-emerald-900/60 dark:bg-zinc-900"
          : "border-black/10 bg-white dark:border-white/15 dark:bg-zinc-900"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <label
              htmlFor={prompt.name}
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
            >
              {prompt.title}
            </label>
            {filled && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <CheckIcon className="h-3.5 w-3.5" />
                Added
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
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
            className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-black/10 bg-zinc-50 px-3 py-1 text-left text-xs font-medium text-zinc-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-blue-900/80 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
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

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          {filled
            ? "This now appears in your partner preview."
            : "Pick a chip or write it your way."}
        </span>
        <span className="shrink-0">
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
    <section className="rounded-lg border border-black/10 bg-zinc-50 p-4 dark:border-white/15 dark:bg-zinc-950/40">
      <div className="flex items-center gap-2">
        <EyeIcon className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Partner preview
        </h3>
      </div>

      {previewItems.length > 0 ? (
        <dl className="mt-3 flex flex-col gap-3">
          {previewItems.map((item) => (
            <div key={item.label}>
              <dt className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                {item.label}
              </dt>
              <dd className="mt-0.5 whitespace-pre-line text-sm text-zinc-800 dark:text-zinc-200">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Add one prompt and this turns into the short intro another runner sees.
        </p>
      )}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function SparkIcon({ className }: { className?: string }) {
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
      <path d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2z" />
      <path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16z" />
    </svg>
  );
}

function TrailIcon({ className }: { className?: string }) {
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
      <path d="M4 18c3 0 3-4 6-4s3 4 6 4 3-4 6-4" />
      <path d="M4 10c3 0 3-4 6-4s3 4 6 4 3-4 6-4" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
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
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 1 1 18-4z" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
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
