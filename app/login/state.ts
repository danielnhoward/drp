import type { Gender } from "@/lib/gender";

// "email": only the email field is showing.
// "profile": email + the profile fields are showing (new signup, or an
// existing-but-incomplete account finishing onboarding).
export type AuthStage = "email" | "profile";

export type AuthState = {
  stage: AuthStage;
  email: string;
  // Retained between renders so the user doesn't lose what they typed on a
  // validation error.
  name: string;
  dateOfBirth: string;
  gender: Gender | "";
  fiveKTime: string;
  error?: string;
};

export const INITIAL_AUTH_STATE: AuthState = {
  stage: "email",
  email: "",
  name: "",
  dateOfBirth: "",
  gender: "",
  fiveKTime: "",
};
