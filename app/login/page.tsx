import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/users";
import LoginForm from "./login-form";

// The session check reads cookies, which forces this page to be dynamic.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in? Skip the form.
  const existing = await getCurrentUser();
  if (existing) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Enter your email to continue. We&apos;ll create an account if you
          don&apos;t have one.
        </p>
      </header>

      <LoginForm />

      <p className="text-center text-xs text-zinc-500 dark:text-zinc-500">
        <Link href="/admin" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
          Admin
        </Link>
      </p>
    </main>
  );
}
