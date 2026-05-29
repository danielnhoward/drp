import Link from "next/link";
import { redirect } from "next/navigation";

import { isGender } from "@/lib/gender";
import { getCurrentUser, isProfileComplete } from "@/lib/users";
import AuthForm from "./auth-form";
import { INITIAL_AUTH_STATE, type AuthState } from "./state";

// Reads the session cookie, so this page must be dynamic.
export const dynamic = "force-dynamic";

function formatMMSS(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default async function LoginPage() {
  const current = await getCurrentUser();

  // Already finished signing up? Nothing to do here.
  if (current && isProfileComplete(current)) redirect("/");

  // Signed-in legacy user with NULL fields — drop them straight into the
  // profile stage with their existing data pre-filled.
  const initial: AuthState = current
    ? {
        stage: "profile",
        email: current.email,
        name: current.name,
        dateOfBirth: current.dateOfBirth ?? "",
        gender:
          current.gender && isGender(current.gender) ? current.gender : "",
        fiveKTime:
          current.preferredPaceSeconds !== null
            ? formatMMSS(current.preferredPaceSeconds * 5)
            : "",
      }
    : INITIAL_AUTH_STATE;

  const isFinishingProfile = initial.stage === "profile" && current !== null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          {isFinishingProfile ? "Finish your profile" : "Sign in"}
        </h1>
        <h1 className="text-2xl tracking-tight">
          Hello Bob!
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {isFinishingProfile
            ? "A few details are missing before you can start matching with runners."
            : "Enter your email to continue. New here? We’ll set you up in one step."}
        </p>
      </header>

      <AuthForm initialState={initial} />

      <p className="text-center text-xs text-zinc-500 dark:text-zinc-500">
        <Link
          href="/admin"
          className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Admin
        </Link>
      </p>
    </main>
  );
}
