// Shared between server and client (profile form), so this file must stay
// free of "server-only" imports.
// Gender is required (NOT NULL) once a profile is complete, so "prefer not to
// say" lives here as an explicit value rather than as the empty/null choice.
export const GENDERS = ["female", "male", "non-binary", "prefer-not-to-say"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  female: "Female",
  male: "Male",
  "non-binary": "Non-binary",
  "prefer-not-to-say": "Prefer not to say",
};

export function isGender(value: string): value is Gender {
  return (GENDERS as readonly string[]).includes(value);
}
