import { isGender } from "@/lib/gender";
import { requireCompleteUser } from "@/lib/users";
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

      <ProfileForm
        initialName={user.name}
        initialDateOfBirth={user.dateOfBirth}
        initialGender={gender}
        initialPreferredPaceSeconds={user.preferredPaceSeconds}
      />

      <hr className="my-8 border-black/10 dark:border-white/15" />

      <form action={logoutAction} className="flex justify-center">
        <button
          type="submit"
          className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-white/20 dark:hover:bg-zinc-900"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
