import Link from "next/link";
import { redirect } from "next/navigation";

import { isGender } from "@/lib/gender";
import { formatMMSS } from "@/lib/profile-fields";
import { getCurrentUser, isProfileComplete } from "@/lib/users";
import OnboardingWizard from "./onboarding-wizard";
import { INITIAL_VALUES, type OnboardingValues } from "./state";

// Reads the session cookie, so this page must be dynamic.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const current = await getCurrentUser();

  // Already finished signing up? Nothing to do here.
  if (current && isProfileComplete(current)) redirect("/");

  // A signed-in user with missing required fields (legacy NULL rows) resumes the
  // wizard with their details prefilled and the email step skipped. A brand-new
  // visitor starts from a blank slate at the email step.
  const resuming = current !== null;
  const initialValues: OnboardingValues = current
    ? {
        email: current.email,
        name: current.name,
        dateOfBirth: current.dateOfBirth ?? "",
        gender:
          current.gender && isGender(current.gender) ? current.gender : "",
        fiveKTime:
          current.preferredPaceSeconds !== null
            ? formatMMSS(current.preferredPaceSeconds * 5)
            : "",
        whyRun: current.whyRun ?? "",
        hobbies: current.hobbies ?? "",
        interests: current.interests ?? "",
      }
    : INITIAL_VALUES;

  return (
    <main className="page-enter flex w-full flex-1 flex-col">
      <OnboardingWizard resuming={resuming} initialValues={initialValues} />

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
