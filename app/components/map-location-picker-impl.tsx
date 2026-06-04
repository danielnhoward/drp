"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";

// Leaflet-backed location picker. The map shows whatever's under a fixed
// centre pin (HTML overlay, not a Leaflet marker) — dragging the map under
// the pin is much friendlier on touch than tapping a small target. The
// selected lat/lon is surfaced through hidden inputs so the component drops
// straight into any <form>.
//
// This file is loaded only on the client; see map-location-picker.tsx for
// the dynamic-import wrapper that enforces that.
export default function MapLocationPickerImpl({
  initialLat,
  initialLon,
  initialZoom = 13,
  nameLat = "lat",
  nameLon = "lon",
}: {
  initialLat: number;
  initialLon: number;
  initialZoom?: number;
  nameLat?: string;
  nameLon?: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [lat, setLat] = useState(initialLat);
  const [lon, setLon] = useState(initialLon);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Where the press that produced the current click began. The geolocate
  // button is overlaid on the map, so a thumb that starts a pan on top of it
  // and releases still synthesises a click. We record the pointer-down point
  // and ignore the click if the pointer travelled far enough to be a drag,
  // which keeps the button tappable without hijacking pans that start on it.
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);

  // Initial mount only — Leaflet manages its own DOM thereafter. Imperative
  // updates (e.g. setView from the geolocate button) go through mapRef.
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;

    const map = L.map(el, {
      center: [initialLat, initialLon],
      zoom: initialZoom,
      // We render the zoom buttons via Leaflet but reposition the
      // geolocation button ourselves, so the default top-left placement
      // conflicts with nothing.
      zoomControl: true,
      // Leaflet's default attribution prefix is "Leaflet"; we don't need to
      // brand the picker, the OSM credit alone is what the licence requires.
      attributionControl: true,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,

      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Keep the displayed coords and hidden inputs in lockstep with the map
    // centre. `move` fires on every animation frame during a drag, which is
    // fine for the small state update here.
    const onMove = () => {
      const c = map.getCenter();
      setLat(c.lat);
      setLon(c.lng);
    };
    map.on("move", onMove);

    mapRef.current = map;
    return () => {
      map.off("move", onMove);
      map.remove();
      mapRef.current = null;
    };
    // initialLat/Lon/Zoom are intentionally read once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only fire geolocation if the press that led here didn't move far — a real
  // tap, not a pan that happened to start on the button.
  const onButtonClick = (e: React.MouseEvent) => {
    const start = pressStartRef.current;
    pressStartRef.current = null;
    if (start) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) > 10) return;
    }
    requestMyLocation();
  };

  const requestMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation isn't available in this browser.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const map = mapRef.current;
        if (!map) {
          setLocating(false);
          return;
        }
        // Hold the button disabled until the camera has actually settled.
        // `moveend` fires both when the flyTo finishes naturally and when
        // the user interrupts it with a drag — either way, that's when
        // it's safe to allow another locate. Re-enabling instantly meant
        // an accidental second tap mid-flight (the geolocation result is
        // cached, so it fires in ms) would snap the map straight back.
        map.once("moveend", () => setLocating(false));
        // 0.6s is short enough that a small fine-tune pan isn't competing
        // with the animation for long, but still smooth enough to read as
        // a fly-to rather than a teleport.
        map.flyTo(
          [pos.coords.latitude, pos.coords.longitude],
          15,
          { duration: 0.6 },
        );
      },
      (err) => {
        setError(err.message || "Couldn't get your location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-64 w-full overflow-hidden rounded-xl border border-black/10 dark:border-white/15">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Centre pin overlay. Tip is anchored at the map centre via the
            translate, so the chosen coordinate is the tip, not the badge. */}
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 z-[1000]"
          style={{ transform: "translate(-50%, -100%)" }}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 32"
            className="h-8 w-6 drop-shadow"
            fill="#2563eb"
            stroke="white"
            strokeWidth={1.5}
          >
            <path d="M12 1c-6 0-11 4.5-11 11 0 8 11 19 11 19s11-11 11-19c0-6.5-5-11-11-11z" />
            <circle cx="12" cy="12" r="4" fill="white" stroke="none" />
          </svg>
        </div>

        {/* Geolocate button overlaid on the map for prominence. It's a solid,
            shadowed pill so it reads clearly against the tiles, and an
            onPointerDown/onClick drag-guard (see pressStartRef) keeps a pan
            that starts on it from firing geolocation as the pan ends. */}
        <button
          type="button"
          onPointerDown={(e) => {
            pressStartRef.current = { x: e.clientX, y: e.clientY };
          }}
          onClick={onButtonClick}
          disabled={locating}
          className="absolute bottom-3 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-lg transition-colors hover:bg-blue-700 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          {locating ? (
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 animate-spin"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <circle cx="12" cy="12" r="8" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
            </svg>
          )}
          <span>Use my location</span>
        </button>
      </div>

      <div className="flex justify-end text-xs text-zinc-500 dark:text-zinc-400">
        <span className="tabular-nums">
          {lat.toFixed(5)}, {lon.toFixed(5)}
        </span>
      </div>

      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <input type="hidden" name={nameLat} value={lat} />
      <input type="hidden" name={nameLon} value={lon} />
    </div>
  );
}
