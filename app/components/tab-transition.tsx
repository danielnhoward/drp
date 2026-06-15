"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

// Order of the bottom-nav tabs, left to right. The slide direction is derived
// from the change in index: moving to a tab further right slides the incoming
// page in from the right, and vice-versa.
const TABS = ["/profile", "/", "/schedule"] as const;
const ANIM_CLASSES = ["anim-fade", "anim-slide-in-left", "anim-slide-in-right"];

function tabIndex(pathname: string): number {
  if (pathname === "/") return TABS.indexOf("/");
  // Prefix match so Schedule nested routes (e.g. /schedule/3/edit) count as
  // that tab.
  return TABS.findIndex((tab) => tab !== "/" && pathname.startsWith(tab));
}

// Run the transition before paint on the client; fall back to useEffect on the
// server to avoid React's "useLayoutEffect does nothing on the server" warning.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Wraps the page subtree and replays a CSS entrance animation on every
 * navigation. Between bottom-nav tabs the entrance is a directional slide; any
 * other navigation (same tab, login, admin) gets a quiet fade. The animation is
 * restarted by forcing a reflow rather than remounting, so page state on a tab
 * isn't thrown away unnecessarily.
 */
export default function TabTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  // Previous tab index; null until the first navigation. Lives on the stable
  // wrapper (never remounts) and is only ever touched inside the effect.
  const prevTab = useRef<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const current = tabIndex(pathname);
    const prev = prevTab.current;
    if (current !== -1) prevTab.current = current;

    let animation = "anim-fade";
    if (current !== -1 && prev !== null && prev !== -1 && current !== prev) {
      animation =
        current > prev ? "anim-slide-in-right" : "anim-slide-in-left";
    }

    el.classList.remove(...ANIM_CLASSES);
    el.getBoundingClientRect(); // force reflow so the animation restarts
    el.classList.add(animation);
  }, [pathname]);

  return (
    <div ref={ref} className="flex flex-1 flex-col">
      {children}
    </div>
  );
}
