"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { SVGProps } from "react";

type NavItem = {
  href: Route;
  label: string;
  Icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
};

const items: NavItem[] = [
  { href: "/profile", label: "Profile", Icon: ProfileIcon },
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      // Fixed to the bottom across all viewports. The safe-area padding keeps
      // the bar clear of the iOS home indicator on mobile.
      className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/90 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] dark:border-white/15 dark:bg-black/80"
    >
      {/* Centred, width-capped row so the bar reads as a tab bar on mobile and
          a compact toolbar on wider desktop screens. */}
      <ul className="mx-auto flex h-16 max-w-md items-stretch justify-around px-2 sm:max-w-lg">
        {items.map(({ href, label, Icon }) => {
          // Exact match for the home route, prefix match for the rest so nested
          // routes (e.g. /profile/settings) keep their tab highlighted.
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={href} className="flex flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                }`}
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x={3} y={4.5} width={18} height={16} rx={2} />
      <path d="M3 9h18M8 3v3m8-3v3" />
    </svg>
  );
}

function ProfileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx={12} cy={8} r={4} />
      <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
    </svg>
  );
}
