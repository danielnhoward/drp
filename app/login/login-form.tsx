"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "./actions";

const INITIAL: LoginState = {};

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          className="rounded-md border border-black/10 bg-white px-3 py-2 text-base outline-none focus:border-blue-500 dark:border-white/15 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Name</span>
        <input
          type="text"
          name="name"
          required
          autoComplete="name"
          className="rounded-md border border-black/10 bg-white px-3 py-2 text-base outline-none focus:border-blue-500 dark:border-white/15 dark:bg-zinc-900"
        />
      </label>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
