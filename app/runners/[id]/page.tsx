import Image from "next/image";
import { notFound } from "next/navigation";

import { ageFromDateOfBirth } from "@/lib/format-date";
import { GENDER_LABELS, isGender } from "@/lib/gender";
import { findUserById, requireCompleteUser } from "@/lib/users";

// Reads from the database per request.
export const dynamic = "force-dynamic";

export default async function RunnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Only signed-in, onboarded users can browse other runners.
  await requireCompleteUser();

  const { id } = await params;
  const runnerId = Number(id);
  if (!Number.isInteger(runnerId) || runnerId <= 0) notFound();

  const runner = findUserById(runnerId);
  if (!runner) notFound();

  const age = ageFromDateOfBirth(runner.dateOfBirth!);
  const gender = isGender(runner.gender!) ? GENDER_LABELS[runner.gender] : runner.gender;
  // Stored pace is seconds/km; a 5k takes five times that. Mirrors how the
  // profile form presents pace as a 5k time.
  const fiveKTime = formatMMSS(runner.preferredPaceSeconds! * 5);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-8">
      <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/15 dark:bg-zinc-900">
        <div className="flex items-center gap-5">
          {runner.avatar ? (
            <Image
              src={runner.avatar}
              alt={`${runner.name}'s profile picture`}
              width={96}
              height={96}
              className="h-24 w-24 shrink-0 rounded-2xl border border-black/10 object-cover dark:border-white/15"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-zinc-100 text-3xl font-semibold text-zinc-500 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {runner.name.charAt(0)}
            </span>
          )}

          <dl className="flex min-w-0 flex-col gap-1.5">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {runner.name}
            </h1>
            <Detail label="Age">{age}</Detail>
            <Detail label="Gender">{gender}</Detail>
            <Detail label="Comfortable 5k">{fiveKTime}</Detail>
          </dl>
        </div>
      </div>
    </main>
  );
}

function formatMMSS(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-1.5 text-base">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}:</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
