import type { Gender } from "@/lib/gender";

// The onboarding wizard asks one question per screen. Each screen is a step;
// the ids here are shared between the client wizard (which renders them) and
// the server actions (which validate and can point the wizard back at a step).
export type StepId =
  | "email"
  | "name"
  | "dateOfBirth"
  | "gender"
  | "pronouns"
  | "photo"
  | "ranBefore"
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
  "pronouns",
  "photo",
  "ranBefore",
  "pace",
  "whyRun",
  "hobbies",
  "interests",
  "review",
];

// Steps the user can skip. Everything else (email + name/dob/gender) is required
// before the account is created — matching isProfileComplete in lib/users.ts.
export const OPTIONAL_STEPS = new Set<StepId>([
  "pronouns",
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
  pronouns: string;
  // Whether the user has run before. UI-only: it branches the wizard (No skips
  // the pace step and reframes the next two prompts) but is never persisted.
  ranBefore: "yes" | "no" | "";
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
  pronouns: "",
  ranBefore: "",
  fiveKTime: "",
  whyRun: "",
  hobbies: "",
  interests: "",
};

// Beginner-branch ("Have you run before?" = No) overrides for the vibe prompts.
// Only title/microcopy/placeholder change — suggestion chips are reused from
// VIBE_PROMPTS so the two branches share answer hints. Kept here rather than in
// profile-content.tsx because the profile editor keeps showing the original
// running-focused prompts; only onboarding's No-branch uses these.
export const BEGINNER_VIBE_COPY: Record<
  "whyRun" | "hobbies",
  { title: string; microcopy: string; placeholder: string }
> = {
  whyRun: {
    title: "What do you hope to get out of running with us?",
    microcopy:
      "Tell your future running partner what would make starting out feel good.",
    placeholder:
      "e.g. I'd love some company and gentle accountability to build a habit from scratch.",
  },
  hobbies: {
    title: "What are you into lately?",
    microcopy:
      "A couple of current interests makes the pre-run hello less awkward.",
    placeholder:
      "e.g. Trying new coffee spots, cooking, and learning guitar badly but happily.",
  },
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
