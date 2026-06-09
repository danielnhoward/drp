import type { SVGProps } from "react";
import { isGender } from "@/lib/gender";
import { getRatingSummaryForUser } from "@/lib/ratings";
import { requireCompleteUser } from "@/lib/users";
import RatingBadge from "../components/rating-badge";
import { logoutAction } from "../login/actions";
import AvatarForm from "./avatar-form";
import ProfileForm from "./profile-form";

// Reads cookies, so it can't be rendered statically.
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  // requireCompleteUser bounces incomplete users to /welcome, so we know all
  // profile fields are present once we get here.
  const user = await requireCompleteUser();

  // Narrow the stored string to the Gender union for the form. Anything that
  // somehow isn't a known value falls back to no selection.
  const gender = isGender(user.gender) ? user.gender : "";
  const ratingSummary = getRatingSummaryForUser(user.id);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Your account details and running preferences, used to find you
          compatible partners.
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {user.email}
        </p>
      </header>

      <AvatarForm name={user.name} initialAvatar={user.avatar} />

      <section className="mb-6 rounded-lg border border-black/10 bg-zinc-50 px-4 py-3 dark:border-white/15 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Trust rating</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Shown to future run partners after they match with you.
            </p>
          </div>
          <RatingBadge summary={ratingSummary} />
        </div>
      </section>

      <ProfileForm
        initialName={user.name}
        initialDateOfBirth={user.dateOfBirth}
        initialGender={gender}
        initialPreferredPaceSeconds={user.preferredPaceSeconds}
        initialWhyRun={user.whyRun}
        initialHobbies={user.hobbies}
        initialInterests={user.interests}
      />

      <hr className="my-8 border-black/10 dark:border-white/15" />

      <form action={logoutAction}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-md border border-red-600/30 px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-400/30 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <SignOutIcon className="h-5 w-5" aria-hidden="true" />
          Sign out
        </button>
      </form>
    </main>
  );
}

function SignOutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
