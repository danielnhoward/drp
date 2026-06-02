import "server-only";

import { formatCoords } from "./matching";

const NOMINATIM_BASE =
  "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT =
  "DRP-RunnerMatchingApp/1.0 (contact: vlad.filip.self@gmail.com)";

// Round to 3 decimal places → ~111 m buckets, good enough for a meeting point.
const CACHE_PRECISION = 3;

const cache = new Map<string, string>();
let lastRequestMs = 0;

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(CACHE_PRECISION)},${lon.toFixed(CACHE_PRECISION)}`;
}

function formatAddress(address: Record<string, string>): string {
  const poi =
    address.tourism ??
    address.amenity ??
    address.leisure ??
    address.building ??
    address.natural;

  const street = [address.house_number, address.road]
    .filter(Boolean)
    .join(" ");

  const primary = poi ?? street;
  const locality =
    address.suburb ?? address.neighbourhood ?? address.quarter;
  const city =
    address.city ?? address.town ?? address.village ?? address.municipality;

  return [primary, locality, city].filter(Boolean).join(", ");
}

export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<string> {
  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const now = Date.now();
  const gap = now - lastRequestMs;
  if (gap < 1100) {
    await new Promise<void>((resolve) => setTimeout(resolve, 1100 - gap));
  }
  lastRequestMs = Date.now();

  try {
    const url = `${NOMINATIM_BASE}?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = (await response.json()) as {
      address?: Record<string, string>;
    };
    const result = data.address ? formatAddress(data.address) : "";
    const label = result || formatCoords(lat, lon);

    cache.set(key, label);
    return label;
  } catch {
    const fallback = formatCoords(lat, lon);
    cache.set(key, fallback);
    return fallback;
  }
}
