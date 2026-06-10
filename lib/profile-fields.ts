// Pure helpers for the profile / onboarding fields, shared between the profile
// page and the signup wizard. Kept free of "server-only" so the parsing runs
// in server actions and the formatting runs in client components from one
// source of truth — no copy drift between the two flows.

// Matches "M:SS" or "MM:SS" — minutes 1–2 digits, seconds always 2.
export const MMSS = /^(\d{1,2}):([0-5]\d)$/;

/** Parses an "mm:ss" string to total seconds, or null if malformed. */
export function parseMMSS(value: string): number | null {
  const match = MMSS.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Formats a number of seconds as "m:ss" (single-digit minutes allowed). */
export function formatMMSS(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Keeps time inputs phone-friendly: users can type digits only and the colon is
 * inserted as soon as they start typing seconds.
 */
export function formatMMSSInput(value: string): string {
  const cleaned = value.replace(/[^\d:]/g, "");

  if (cleaned.includes(":")) {
    const [minutesRaw = "", ...secondsParts] = cleaned.split(":");
    const minutes = minutesRaw.replace(/\D/g, "").slice(0, 2);
    const seconds = secondsParts.join("").replace(/\D/g, "").slice(0, 2);

    if (!minutes) return seconds;
    if (cleaned.endsWith(":") && !seconds) return `${minutes}:`;
    return seconds ? `${minutes}:${seconds}` : minutes;
  }

  const digits = cleaned.slice(0, 4);
  if (digits.length <= 2) return digits;

  if (digits.length === 3 && Number(digits.slice(0, 2)) > 59) {
    return `${digits[0]}:${digits.slice(1)}`;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/**
 * Converts a 5k time (as collected in the UI) to a comfortable pace in seconds
 * per kilometre, or null when the input is blank. Returns an `error` message
 * when the time is present but malformed. Mirrors how the availability flow
 * collects pace as a 5k time and stores it as seconds/km.
 */
export function paceSecondsFromFiveK(
  value: string,
): { value: number | null } | { error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { value: null };
  const fiveK = parseMMSS(trimmed);
  if (fiveK === null || fiveK <= 0) {
    return { error: "Enter your 5k time as mm:ss (e.g. 22:30)." };
  }
  return { value: Math.round(fiveK / 5) };
}

// Optional free-text fields are capped so a single profile can't store an
// unbounded blob. Generous enough for a few sentences each.
export const MAX_ABOUT_LENGTH = 500;

/**
 * Trims an optional text field to null when blank. Returns the field's error
 * message if it exceeds the length cap, otherwise the cleaned value.
 */
export function parseOptionalText(
  value: string,
  label: string,
): { value: string | null } | { error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { value: null };
  if (trimmed.length > MAX_ABOUT_LENGTH) {
    return { error: `Keep ${label} under ${MAX_ABOUT_LENGTH} characters.` };
  }
  return { value: trimmed };
}
