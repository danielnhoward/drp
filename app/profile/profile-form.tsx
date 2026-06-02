"use client";

import { useActionState } from "react";

import { GENDERS, GENDER_LABELS, type Gender } from "@/lib/gender";
import { updateProfileAction, type ProfileFormState } from "./actions";

type Props = {
  initialName: string;
  initialDateOfBirth: string;
  // "" only appears as a fallback when the stored value isn't a known Gender
  // — the <select> is `required` so submission still forces a real choice.
  initialGender: Gender | "";
  /** Comfortable pace in seconds per km. */
  initialPreferredPaceSeconds: number;
  /** Optional "about me" free text — null when unset. */
  initialWhyRun: string | null;
  initialHobbies: string | null;
  initialInterests: string | null;
};

const INITIAL_STATE: ProfileFormState = {};

const fieldClass =
  "h-10 rounded-lg border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-black/40 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white/50";

const textareaClass =
  "min-h-20 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none focus:border-black/40 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white/50";

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

  // Convert stored pace (seconds/km) back to a 5k time for the input, since
  // the form collects 5k time to match the availability flow.
  const initialFiveK = formatMMSS(initialPreferredPaceSeconds * 5);

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
            Select…
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
          inputMode="numeric"
          defaultValue={initialFiveK}
        />
      </Field>

      <fieldset className="mt-2 flex flex-col gap-4 border-t border-black/10 pt-5 dark:border-white/15">
        <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          A bit more about you{" "}
          <span className="font-normal text-zinc-500 dark:text-zinc-400">
            — optional
          </span>
        </legend>
        <p className="-mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Share whatever you like. It helps a new running partner feel they know
          you and gives you both more to talk about on the run.
        </p>

        <Field label="Why I like running with others">
          <textarea
            className={textareaClass}
            name="whyRun"
            rows={2}
            maxLength={500}
            placeholder="e.g. I find it easier to stay motivated with company."
            defaultValue={initialWhyRun ?? ""}
          />
        </Field>

        <Field label="Recent hobbies (outside running)">
          <textarea
            className={textareaClass}
            name="hobbies"
            rows={2}
            maxLength={500}
            placeholder="e.g. Started learning the guitar, into baking sourdough."
            defaultValue={initialHobbies ?? ""}
          />
        </Field>

        <Field label="Other interests">
          <textarea
            className={textareaClass}
            name="interests"
            rows={2}
            maxLength={500}
            placeholder="e.g. Films, travel, football, board games…"
            defaultValue={initialInterests ?? ""}
          />
        </Field>
      </fieldset>

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
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
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
