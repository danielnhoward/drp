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
        <h1 className="text-gradient text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted">
          Impersonate any user. This page has no access control.
        </p>
      </header>

      <section className="card mb-6 px-4 py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              Current session
            </p>
            <p className="font-medium text-foreground">
              {current
                ? `${current.name} (${current.email})`
                : "Not signed in"}
            </p>
          </div>
          {current && (
            <form action={adminLogoutAction}>
              <button
                type="submit"
                className="btn-ghost tap px-3 py-1.5 text-xs font-medium"
              >
                Sign out
              </button>
            </form>
          )}
        </div>
      </section>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Users (<span className="font-mono tnum">{users.length}</span>)
      </h2>

      {users.length === 0 ? (
        <p className="text-muted">
          No users yet —{" "}
          <Link href="/login" className="text-accent underline">
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
                className="anim-rise flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{user.name}</p>
                  <p className="truncate text-sm text-muted">
                    {user.email}
                  </p>
                </div>
                <form action={impersonateAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <button
                    type="submit"
                    disabled={isCurrent}
                    className="btn-accent tap px-3 py-1.5 text-sm font-medium disabled:cursor-default disabled:opacity-50"
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
