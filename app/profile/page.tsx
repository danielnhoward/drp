import { requireUser } from "@/lib/users";
import { logoutAction } from "../login/actions";

// Reads cookies, so it can't be rendered statically.
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-10">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{user.name}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {user.email}
        </p>
      </header>

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
