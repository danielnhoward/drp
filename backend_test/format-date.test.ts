import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { isoDateInDays, isoToday, isPastDateTime } from "@/lib/format-date";

// Anchor "now" at 11:00 local on a reference day so past/future comparisons are
// deterministic regardless of when the suite runs.
const NOW = new Date("2026-06-10T11:00:00");
const TODAY = "2026-06-10";
const YESTERDAY = "2026-06-09";
const TOMORROW = "2026-06-11";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isoToday / isoDateInDays", () => {
  // Anchor just after local midnight. In a positive-offset zone this instant is
  // still "yesterday" in UTC, so a toISOString()-based implementation would
  // return the previous day — defaulting the date picker to a past date that
  // then fails the "can't be in the past" check.
  function expectedLocalDate(offsetDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  }

  test("isoToday returns the local calendar date just after midnight", () => {
    vi.setSystemTime(new Date("2026-06-11T00:30:00"));
    expect(isoToday()).toBe(expectedLocalDate(0));
  });

  test("isoDateInDays offsets from the local date", () => {
    vi.setSystemTime(new Date("2026-06-11T00:30:00"));
    expect(isoDateInDays(1)).toBe(expectedLocalDate(1));
    expect(isoDateInDays(-1)).toBe(expectedLocalDate(-1));
  });
});

describe("isPastDateTime", () => {
  test("treats an earlier time today as past, a later time as future", () => {
    expect(isPastDateTime(TODAY, "10:59")).toBe(true);
    expect(isPastDateTime(TODAY, "11:00")).toBe(true); // exactly now is not future
    expect(isPastDateTime(TODAY, "11:01")).toBe(false);
  });

  test("treats any time on a past date as past", () => {
    expect(isPastDateTime(YESTERDAY, "23:59")).toBe(true);
  });

  test("treats any time on a future date as upcoming", () => {
    expect(isPastDateTime(TOMORROW, "00:00")).toBe(false);
  });
});
