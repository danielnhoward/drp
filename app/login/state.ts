import type { Gender } from "@/lib/gender";

// The onboarding wizard asks one question per screen. Each screen is a step;
// the ids here are shared between the client wizard (which renders them) and
// the server actions (which validate and can point the wizard back at a step).
export type StepId =
  | "email"
  | "name"
  | "dateOfBirth"
  | "gender"
  | "photo"
  | "pace"
  | "whyRun"
  | "hobbies"
  | "interests"
  | "review";

// Full order for a brand-new signup. A signed-in user finishing an incomplete
// profile already knows their email, so the wizard drops the "email" step for
// them (see onboarding-wizard.tsx). "review" is the terminal screen: it asks
// nothing, it just confirms and creates the account — keeping "finish" a
// deliberate action on its own screen rather than a button that replaces the
// last question's "Continue" in place.
export const STEP_ORDER: StepId[] = [
  "email",
  "name",
  "dateOfBirth",
  "gender",
  "photo",
  "pace",
  "whyRun",
  "hobbies",
  "interests",
  "review",
];

// Steps the user can skip. Everything else (email + name/dob/gender) is required
// before the account is created — matching isProfileComplete in lib/users.ts.
export const OPTIONAL_STEPS = new Set<StepId>([
  "photo",
  "pace",
  "whyRun",
  "hobbies",
  "interests",
]);

// All the text the wizard collects. The avatar isn't here — it's a File carried
// by a mounted <input type="file">, not serialisable state.
export type OnboardingValues = {
  email: string;
  name: string;
  dateOfBirth: string;
  gender: Gender | "";
  // Conversational 5k time as mm:ss; converted to seconds/km on submit.
  fiveKTime: string;
  whyRun: string;
  hobbies: string;
  interests: string;
};

export const INITIAL_VALUES: OnboardingValues = {
  email: "",
  name: "",
  dateOfBirth: "",
  gender: "",
  fiveKTime: "",
  whyRun: "",
  hobbies: "",
  interests: "",
};

// Returned by lookupEmailAction when the user leaves the email step. A returning
// complete account is signed in and redirected server-side, so that case never
// reaches the client.
export type EmailLookup =
  | { status: "new" }
  | { status: "resume"; values: Partial<OnboardingValues> }
  | { status: "error"; error: string };

// Returned by completeOnboardingAction. `step` lets the wizard jump back to the
// field that failed server-side validation.
export type CompleteState = {
  error?: string;
  step?: StepId;
};

export const INITIAL_COMPLETE_STATE: CompleteState = {};
