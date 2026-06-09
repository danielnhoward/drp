"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "drp-running-vibe-nudge-dismissed-at";
const STORAGE_EVENT = "drp-running-vibe-nudge-change";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

export default function RunningVibeNudge({
  missingCount,
}: {
  missingCount: number;
}) {
  const visible = useSyncExternalStore(
    subscribeToDismissal,
    shouldShowNudge,
    () => false,
  );

  if (!visible || missingCount <= 0) return null;

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }

  return (
    <section className="anim-rise mb-4 rounded-2xl border border-accent/30 bg-surface-2 p-4">
      <div className="flex items-start gap-3">
        <span className="glow-pulse mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <SparkIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {missingCount === 3
              ? "Your partner intro is empty."
              : `${missingCount} partner intro prompt${
                  missingCount === 1 ? "" : "s"
                } left.`}
          </p>
          <p className="mt-1 text-sm text-muted">
            Add a few running-vibe notes so a matched runner has something easy
            to ask you about.
          </p>
          <Link
            href="/profile#running-vibe"
            className="btn-accent tap mt-3 text-sm"
          >
            Add running vibe
          </Link>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss running vibe reminder"
          className="-mr-1 -mt-1 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function subscribeToDismissal(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STORAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STORAGE_EVENT, onStoreChange);
  };
}

function shouldShowNudge() {
  if (typeof window === "undefined") return false;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  const dismissedAt = raw ? Number(raw) : 0;

  return !dismissedAt || Date.now() - dismissedAt > DISMISS_MS;
}

function SparkIcon({ className }: { className?: string }) {
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
      <path d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2z" />
      <path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}
