import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser, isProfileComplete } from "@/lib/users";
import WelcomeForm from "./welcome-form";

// Reads the session cookie, so this page must be dynamic.
export const dynamic = "force-dynamic";

// The landing page that sits in front of the login wizard: a welcome and a
// single email box. Logged-out visitors are routed here by proxy.ts; anyone
// already signed in skips it (finished accounts go home, a half-finished
// signup resumes its wizard).
export default async function WelcomePage() {
  const current = await getCurrentUser();
  if (current) {
    redirect(isProfileComplete(current) ? "/" : "/login");
  }

  return (
    <main className="flex w-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <div className="anim-step-up flex flex-col gap-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <BrandMark className="h-16 w-16 drop-shadow-lg" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Welcome to RunDezvous
              </h1>
              <p className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
                Find a running partner who matches your pace, your patch, and
                your schedule.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <WelcomeForm />
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              New here or coming back? Pop in your email to get started — we&apos;ll
              find your account or set one up.
            </p>
          </div>
        </div>
      </div>

      <p className="pb-8 text-center text-xs text-zinc-500 dark:text-zinc-500">
        <Link
          href="/admin"
          className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Admin
        </Link>
      </p>
    </main>
  );
}

// The RunDezvous mark: a gradient map pin (the "meeting point") with a runner's
// motion lines streaking in behind it. Inlined as an SVG to match the rest of
// the icon set and avoid an image fetch for the hero logo.
function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="rdv-brand-grad"
          gradientUnits="userSpaceOnUse"
          x1="12"
          y1="22"
          x2="86"
          y2="84"
        >
          <stop offset="0" stopColor="#2DD4FF" />
          <stop offset="0.5" stopColor="#4D8BFF" />
          <stop offset="1" stopColor="#7C5CFF" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="96" height="96" rx="23" fill="url(#rdv-brand-grad)" />
      <g stroke="#061018" strokeLinecap="round" fill="none">
        <path d="M14 44 H30" strokeWidth="5.5" opacity="0.92" />
        <path d="M11 56 H26" strokeWidth="5.5" opacity="0.66" />
        <path d="M19 68 H32" strokeWidth="5.5" opacity="0.42" />
      </g>
      <g transform="rotate(14 56 50)">
        <path
          d="M56 84 C43 64 35 53 35 40 A21 21 0 1 1 77 40 C77 53 69 64 56 84 Z"
          fill="#061018"
        />
        <circle cx="56" cy="40" r="8" fill="url(#rdv-brand-grad)" />
      </g>
    </svg>
  );
}
