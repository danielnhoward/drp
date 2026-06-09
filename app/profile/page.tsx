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
    <main className="page-enter mx-auto w-full max-w-md flex-1 px-6 py-8">
      <header className="mb-6">
        <h1 className="text-gradient text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted">
          Your account details and running preferences, used to find you
          compatible partners.
        </p>
        <p className="mt-1 text-sm text-muted">
          {user.email}
        </p>
      </header>

      <AvatarForm name={user.name} initialAvatar={user.avatar} />

      <section className="card mb-6 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Trust rating</h2>
            <p className="mt-1 text-xs text-muted">
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

      <hr className="my-8 border-border" />

      <form action={logoutAction} className="flex justify-center">
        <button
          type="submit"
          className="btn-ghost tap text-sm font-medium"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
