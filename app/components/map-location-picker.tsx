"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` at import time, so the implementation has to be
// loaded client-side only. Next's `ssr: false` is allowed here because this
// wrapper is a Client Component (see docs/01-app/02-guides/lazy-loading.md).
const MapLocationPicker = dynamic(
  () => import("./map-location-picker-impl"),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col gap-1.5">
        <div className="h-64 w-full animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      </div>
    ),
  },
);

export default MapLocationPicker;
