import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// reverseGeocode uses module-level state (cache, lastRequestMs). Import
// dynamically inside each test group so vi.resetModules() gives a clean slate.

function makeResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status }),
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("reverseGeocode", () => {
  test("formats a named leisure POI", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(makeResponse({
      address: {
        leisure: "Victoria Park",
        suburb: "Hackney",
        city: "London",
      },
    })));

    const { reverseGeocode } = await import("@/lib/geocoding");
    const result = await reverseGeocode(51.535, -0.039);
    expect(result).toBe("Victoria Park, Hackney, London");
  });

  test("formats a street address when no POI name is present", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(makeResponse({
      address: {
        house_number: "10",
        road: "Downing Street",
        suburb: "Westminster",
        city: "London",
      },
    })));

    const { reverseGeocode } = await import("@/lib/geocoding");
    const result = await reverseGeocode(51.503, -0.127);
    expect(result).toBe("10 Downing Street, Westminster, London");
  });

  test("omits missing parts gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(makeResponse({
      address: {
        road: "High Street",
        city: "Oxford",
      },
    })));

    const { reverseGeocode } = await import("@/lib/geocoding");
    const result = await reverseGeocode(51.752, -1.257);
    expect(result).toBe("High Street, Oxford");
  });

  test("falls back to coordinates on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(makeResponse({}, 500)));

    const { reverseGeocode } = await import("@/lib/geocoding");
    const result = await reverseGeocode(51.5073, -0.1657);
    expect(result).toBe("51.50730, -0.16570");
  });

  test("falls back to coordinates on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network failure")));

    const { reverseGeocode } = await import("@/lib/geocoding");
    const result = await reverseGeocode(51.5073, -0.1657);
    expect(result).toBe("51.50730, -0.16570");
  });

  test("caches results so fetch is called only once for the same location", async () => {
    const fetchMock = vi.fn().mockReturnValue(makeResponse({
      address: { amenity: "Gym", city: "London" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { reverseGeocode } = await import("@/lib/geocoding");
    const first = await reverseGeocode(51.5, -0.1);
    const second = await reverseGeocode(51.5, -0.1);

    expect(first).toBe("Gym, London");
    expect(second).toBe("Gym, London");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("treats coordinates that round to the same bucket as a cache hit", async () => {
    const fetchMock = vi.fn().mockReturnValue(makeResponse({
      address: { road: "Park Lane", city: "London" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { reverseGeocode } = await import("@/lib/geocoding");
    // 51.5001 and 51.5004 both round to 51.500 at 3 dp
    await reverseGeocode(51.5001, -0.1001);
    await reverseGeocode(51.5004, -0.1004);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
