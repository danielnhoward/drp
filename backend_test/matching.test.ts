import { describe, expect, test } from "vitest";

import { minutesToTime, timeToMinutes } from "@/lib/matching";

describe("time helpers", () => {
  test("timeToMinutes / minutesToTime round-trip", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("10:30")).toBe(630);
    expect(timeToMinutes("13:00")).toBe(780);
    expect(minutesToTime(630)).toBe("10:30");
    expect(minutesToTime(690)).toBe("11:30");
    // Rounds to the nearest minute.
    expect(minutesToTime(689.5)).toBe("11:30");
  });
});
