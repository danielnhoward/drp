import Link from "next/link";
import { redirect } from "next/navigation";

import { isGender } from "@/lib/gender";
import { formatMMSS } from "@/lib/profile-fields";
import { getCurrentUser, isProfileComplete } from "@/lib/users";
import OnboardingWizard from "./onboarding-wizard";
import { INITIAL_VALUES, type OnboardingValues } from "./state";

// Reads the session cookie, so this page must be dynamic.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const current = await getCurrentUser();

  // Already finished signing up? Nothing to do here.
  if (current && isProfileComplete(current)) redirect("/");

  // A signed-in user with missing required fields (legacy NULL rows) resumes the
  // wizard with their details prefilled and the email step skipped. A brand-new
  // visitor starts from a blank slate at the email step.
  const resuming = current !== null;

  // A new runner can arrive from the landing page with their email already in
  // hand (as `?email=`). When they do, prefill it and skip the wizard's email
  // step so they're not asked for it a second time — a resuming user's email
  // comes from their saved row instead.
  const { email } = await searchParams;
  const handoffEmail = (email ?? "").trim();
  const skipEmailStep = !resuming && handoffEmail.includes("@");

  const initialValues: OnboardingValues = current
    ? {
        email: current.email,
        name: current.name,
        dateOfBirth: current.dateOfBirth ?? "",
        gender:
          current.gender && isGender(current.gender) ? current.gender : "",
        // UI-only branching flag — not persisted, so a resuming user answers it
        // fresh.
        ranBefore: "",
        fiveKTime:
          current.preferredPaceSeconds !== null
            ? formatMMSS(current.preferredPaceSeconds * 5)
            : "",
        whyRun: current.whyRun ?? "",
        hobbies: current.hobbies ?? "",
        interests: current.interests ?? "",
      }
    : { ...INITIAL_VALUES, email: skipEmailStep ? handoffEmail : "" };

  return (
    <main className="page-enter flex w-full flex-1 flex-col">
      <OnboardingWizard
        resuming={resuming}
        skipEmailStep={skipEmailStep}
        initialValues={initialValues}
      />

      <p className="pb-8 text-center text-xs text-muted">
        <Link
          href="/admin"
          className="underline hover:text-foreground"
        >
          Admin
        </Link>
      </p>
    </main>
  );
}
