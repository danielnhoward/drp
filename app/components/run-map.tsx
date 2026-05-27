"use client";

import { useEffect, useState } from "react";

// Builds an OpenStreetMap embed URL centred on the point, with a marker. This
// needs no API key, so the dummy data renders a real map out of the box. The
// bbox deltas control the zoom — smaller is more zoomed in.
function mapSrc(lat: number, lon: number, dLat: number, dLon: number): string {
  const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
}

export default function RunMap({
  lat,
  lon,
  label,
}: {
  lat: number;
  lon: number;
  /** Human-readable location, used for accessible labels and the modal title. */
  label: string;
}) {
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

  return (
    <>
      {/* Preview: the iframe is non-interactive (pointer-events-none) so the
          overlay button captures the click and opens the modal instead of
          panning the embedded map. */}
      <div className="relative h-32 w-full overflow-hidden rounded-xl border border-black/10 dark:border-white/15">
        <iframe
          title={`Map showing ${label}`}
          src={mapSrc(lat, lon, 0.006, 0.009)}
          loading="lazy"
          className="pointer-events-none h-full w-full"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Expand map for ${label}`}
          className="absolute inset-0 cursor-pointer transition-colors hover:bg-black/5"
        />
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Map for ${label}`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop — click to dismiss. */}
          <button
            type="button"
            aria-label="Close map"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-black/50"
          />

          <div className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between gap-2 border-b border-black/10 p-3 dark:border-white/15">
              <p className="min-w-0 truncate font-medium">{label}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close map"
                className="rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-50"
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
            </div>

            <iframe
              title={`Expanded map showing ${label}`}
              src={mapSrc(lat, lon, 0.02, 0.03)}
              className="h-[60vh] w-full"
            />

            <div className="border-t border-black/10 p-3 text-sm dark:border-white/15">
              <a
                href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                View on OpenStreetMap
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
