// Shared between server and client (profile form), so this file must stay
// free of "server-only" imports.
// "Prefer not to say" isn't an enum value — it's just the absence of one
// (null in the DB, the empty option in the <select>).
export const GENDERS = ["female", "male", "non-binary"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  female: "Female",
  male: "Male",
  "non-binary": "Non-binary",
};

export function isGender(value: string): value is Gender {
  return (GENDERS as readonly string[]).includes(value);
}
