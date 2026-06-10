import Link from "next/link";

import { requireCompleteUser } from "@/lib/users";
import PronounsForm from "./pronouns-form";

// Reads cookies, so it can't be rendered statically.
export const dynamic = "force-dynamic";

export default async function PronounsPage() {
  const user = await requireCompleteUser();

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-8">
      <header className="mb-6">
        <Link
          href="/profile"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Profile
        </Link>
        <h1 className="text-gradient text-2xl font-semibold tracking-tight">
          Pronouns
        </h1>
        <p className="mt-1 text-sm text-muted">
          This appears on the profile runners see after matching with you.
        </p>
      </header>

      <PronounsForm initialPronouns={user.pronouns} />
    </main>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}
