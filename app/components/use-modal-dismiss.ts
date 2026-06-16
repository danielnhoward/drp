"use client";

import { useEffect, useRef } from "react";

/**
 * Shared behaviour for our portalled modals: while `active`, pressing Escape
 * closes the modal and the page behind it is scroll-locked.
 *
 * The background scroller is the layout's `#app-scroll` container (the body
 * itself never scrolls — see app/layout.tsx), so we lock that element rather
 * than `document.body`. `onClose` is read through a ref so a fresh inline
 * closure each render doesn't re-run the effect.
 */
export function useModalDismiss(active: boolean, onClose: () => void) {
  // Keep the latest `onClose` in a ref so the lock effect can depend on `active`
  // alone — a fresh inline closure each render won't re-run (and re-lock) it.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!active) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);

    const scroller = document.getElementById("app-scroll");
    const prevOverflow = scroller?.style.overflow ?? "";
    if (scroller) scroller.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      if (scroller) scroller.style.overflow = prevOverflow;
    };
  }, [active]);
}
