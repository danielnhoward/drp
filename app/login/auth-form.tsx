"use client";

import { useActionState } from "react";

import { GENDERS, GENDER_LABELS } from "@/lib/gender";
import { authAction } from "./actions";
import type { AuthState } from "./state";

type Props = {
  initialState: AuthState;
};

const fieldClass =
  "h-10 rounded-lg border border-black/10 bg-white px-3 text-sm text-black outline-none focus:border-black/40 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white/50";

export default function AuthForm({ initialState }: Props) {
  const [state, action, pending] = useActionState(authAction, initialState);

  const showProfile = state.stage === "profile";

  return (
    <form
      action={action}
      // The key resets internal form state (e.g. the password manager auto-fill
      // banner) when transitioning from the email-only stage to the profile
      // stage, so the newly-revealed fields render cleanly.
      key={state.stage}
      className="flex flex-col gap-4"
    >
      {/* The server action reads this to know which stage was rendered. */}
      <input type="hidden" name="stage" value={state.stage} />

      <Field label="Email">
        <input
          className={fieldClass}
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus={!showProfile}
          defaultValue={state.email}
        />
      </Field>

      {showProfile && (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            New here — tell us a bit about yourself.
          </p>

          <Field label="Name">
            <input
              className={fieldClass}
              type="text"
              name="name"
              required
              autoComplete="name"
              autoFocus
              defaultValue={state.name}
            />
          </Field>

          <Field label="Date of birth">
            <input
              className={fieldClass}
              type="date"
              name="dateOfBirth"
              required
              defaultValue={state.dateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
            />
          </Field>

          <Field label="Gender">
            <select
              className={fieldClass}
              name="gender"
              required
              defaultValue={state.gender}
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
              defaultValue={state.fiveKTime}
            />
          </Field>
        </>
      )}

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
      >
        {pending
          ? showProfile
            ? "Saving…"
            : "Continuing…"
          : showProfile
            ? "Create account"
            : "Continue"}
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
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
