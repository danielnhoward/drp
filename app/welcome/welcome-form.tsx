"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { lookupEmailAction } from "@/app/login/actions";

// Mirrors the wizard's email field so the landing input feels like the same
// form the user is about to continue into.
const fieldClass =
  "h-12 w-full rounded-lg border border-black/10 bg-white px-3.5 text-base text-black outline-none transition-colors focus:border-black/40 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white/50";

// One email box for both new and returning runners. It runs the same lookup as
// the onboarding wizard's first step, then routes accordingly:
//   - a complete account is signed in and sent home by the action itself;
//   - a returning runner mid-signup resumes the wizard from their saved row;
//   - a new email is carried into the wizard so they aren't asked for it twice.
export default function WelcomeForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const value = email.trim();
    if (!value) return setError("Enter your email.");
    if (!value.includes("@")) return setError("Enter a valid email.");

    startTransition(async () => {
      // A complete account is signed in and redirected home by the action, so
      // control never returns here for that case.
      const result = await lookupEmailAction(value);
      if (result.status === "error") {
        setError(result.error);
        return;
      }
      // Returning runner mid-signup: the action set their session, so the wizard
      // picks up from the saved profile with the email step already behind it.
      if (result.status === "resume") {
        router.push("/login");
        return;
      }
      // New runner: hand the email to the wizard so the first thing they're
      // asked isn't the email all over again.
      router.push(`/login?email=${encodeURIComponent(value)}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label htmlFor="welcome-email" className="sr-only">
        Email
      </label>
      <input
        id="welcome-email"
        className={fieldClass}
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="you@example.com"
        autoFocus
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <button
        type="submit"
        disabled={pending}
        className="flex h-12 items-center justify-center rounded-lg bg-blue-600 px-5 text-base font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Checking…" : "Continue"}
      </button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </form>
  );
}
