"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import type { Runner } from "@/lib/runs";
import { ageFromDateOfBirth } from "@/lib/format-date";
import { GENDER_LABELS, isGender } from "@/lib/gender";

function formatMMSS(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function RunnerModal({ runner }: { runner: Runner }) {
  const [open, setOpen] = useState(false);

  // Close on Escape and lock background scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const age = ageFromDateOfBirth(runner.dateOfBirth);
  const gender = isGender(runner.gender)
    ? GENDER_LABELS[runner.gender]
    : runner.gender;
  // Stored pace is seconds/km; a 5k takes five times that. Pace is optional, so
  // it may be null — the detail is hidden when there's nothing to show.
  const fiveKTime =
    runner.preferredPaceSeconds !== null
      ? formatMMSS(runner.preferredPaceSeconds * 5)
      : null;

  // Optional "get to know me" fields — only render the ones the runner filled
  // in, and skip the whole section when they've shared nothing.
  const about = [
    { label: "Runs feel better when", value: runner.whyRun },
    { label: "Off-run lately", value: runner.hobbies },
    { label: "Easy-run chat", value: runner.interests },
  ].filter((item): item is { label: string; value: string } =>
    Boolean(item.value),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${runner.name}'s profile`}
        className="group flex w-full cursor-pointer items-center gap-2 rounded-xl border border-black/20 px-2.5 py-1.5 hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-zinc-800"
      >
        <Avatar
          avatar={runner.avatar}
          name={runner.name}
          className="h-9 w-9 rounded-full text-sm"
        />
        <span className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
          {runner.name}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-600 dark:text-zinc-600 dark:group-hover:text-zinc-400"
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${runner.name}'s profile`}
           className="fixed inset-0 z-60 flex items-center justify-center p-4"
        >
          {/* Backdrop — click to dismiss. */}
          <button
            type="button"
            aria-label="Close profile"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-black/50"
          />

          <div className="relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close profile"
              className="absolute right-3 top-3 rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>

            <div className="flex items-center gap-5">
              <Avatar
                avatar={runner.avatar}
                name={runner.name}
                className="h-24 w-24 rounded-2xl text-3xl"
              />
              <dl className="flex min-w-0 flex-col gap-1.5">
                <h2 className="truncate text-2xl font-semibold tracking-tight">
                  {runner.name}
                </h2>
                <Detail label="Age">{age}</Detail>
                <Detail label="Gender">{gender}</Detail>
                {fiveKTime && (
                  <Detail label="Conversational 5k">{fiveKTime}</Detail>
                )}
              </dl>
            </div>

            {about.length > 0 && (
              <div className="mt-5 flex flex-col gap-4 border-t border-black/10 pt-4 dark:border-white/15">
                {about.map((item) => (
                  <div key={item.label}>
                    <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                      {item.label}
                    </h3>
                    <p className="mt-0.5 whitespace-pre-line text-base">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {runner.recentRunPhotos.length > 0 && (
              <div className="mt-5 border-t border-black/10 pt-4 dark:border-white/15">
                <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Recent run photos
                </h3>
                <div className="mt-3 flex gap-2">
                  {runner.recentRunPhotos.map((photo, index) => (
                    <div
                      key={`${photo}-${index}`}
                      className="relative aspect-square flex-1 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800"
                    >
                      <Image
                        src={photo}
                        alt={`${runner.name} on a recent run`}
                        fill
                        sizes="(max-width: 640px) 33vw, 96px"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Avatar({
  avatar,
  name,
  className,
}: {
  avatar: string | null;
  name: string;
  className: string;
}) {
  if (avatar) {
    return (
      <Image
        src={avatar}
        alt={`${name}'s profile picture`}
        width={96}
        height={96}
        className={`shrink-0 border border-black/10 object-cover dark:border-white/15 ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center border border-black/10 bg-zinc-100 font-semibold text-zinc-500 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-400 ${className}`}
    >
      {name.charAt(0)}
    </span>
  );
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
