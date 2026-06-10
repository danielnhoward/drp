// Shared pronoun presets and validation for profile forms.

export const PRONOUN_OPTIONS = [
  "he/him",
  "she/her",
  "they/them",
  "Prefer not to say",
] as const;

export const MAX_PRONOUNS_LENGTH = 64;

export function isPronounOption(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return PRONOUN_OPTIONS.some((option) => option.toLowerCase() === normalized);
}

export function parsePronouns(
  raw: string,
): { value: string | null } | { error: string } {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return { value: null };
  if (value.length > MAX_PRONOUNS_LENGTH) {
    return {
      error: `Keep pronouns to ${MAX_PRONOUNS_LENGTH} characters or fewer.`,
    };
  }
  return { value };
}
