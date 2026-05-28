import Link from "next/link";

import { getCurrentUser, listUsers } from "@/lib/users";
import { impersonateAction, adminLogoutAction } from "./actions";

// Reads cookies and the database on every request.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const users = listUsers();
  const current = await getCurrentUser();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Impersonate any user. This page has no access control.
        </p>
      </header>

      <section className="mb-6 rounded-lg border border-black/10 bg-zinc-50 px-4 py-3 text-sm dark:border-white/15 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Current session
            </p>
            <p className="font-medium">
              {current
                ? `${current.name} (${current.email})`
                : "Not signed in"}
            </p>
          </div>
          {current && (
            <form action={adminLogoutAction}>
              <button
                type="submit"
                className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium hover:bg-white dark:border-white/20 dark:hover:bg-zinc-800"
              >
                Sign out
              </button>
            </form>
          )}
        </div>
      </section>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Users ({users.length})
      </h2>

      {users.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">
          No users yet —{" "}
          <Link href="/login" className="underline">
            sign in
          </Link>{" "}
          to create one.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((user) => {
            const isCurrent = current?.id === user.id;
            return (
              <li
                key={user.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-4 py-3 dark:border-white/15"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.name}</p>
                  <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {user.email}
                  </p>
                </div>
                <form action={impersonateAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <button
                    type="submit"
                    disabled={isCurrent}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-default disabled:opacity-50"
                  >
                    {isCurrent ? "Current" : "Impersonate"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
