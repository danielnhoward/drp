// Shared copy + presets for the optional "running vibe" fields, used by both
// the profile editor (profile-form.tsx) and the signup wizard
// (app/login/onboarding-wizard.tsx). Keeping the prompt text, suggestion chips
// and pace presets here means the two flows can't drift apart. No "server-only"
// import — these are plain presentational components and pure data.

export type VibeFieldName = "whyRun" | "hobbies" | "interests";

export type VibePrompt = {
  name: VibeFieldName;
  title: string;
  microcopy: string;
  placeholder: string;
  previewLabel: string;
  suggestions: string[];
  Icon: (props: { className?: string }) => React.ReactNode;
};

export const MAX_VIBE_LENGTH = 500;

// Quick-pick conversational 5k times, offered as chips. Tapping one fills the
// field; runners can still type their own. Spaced every 5 minutes across a
// broad range of easy paces.
export const PACE_PRESETS = ["25:00", "30:00", "35:00", "40:00", "45:00"];

export const VIBE_PROMPTS: VibePrompt[] = [
  {
    name: "whyRun",
    title: "What makes your runs better?",
    microcopy:
      "Tell your future running partner what makes your runs feel easy and enjoyable.",
    placeholder:
      "e.g. I like easy miles with good chat, especially when someone gets me out the door.",
    previewLabel: "Runs feel better when",
    suggestions: [
      "Easy miles with good chat",
      "Accountability when motivation dips",
      "Finding new local routes",
    ],
    Icon: SparkIcon,
  },
  {
    name: "hobbies",
    title: "What are you into lately, apart from running?",
    microcopy:
      "A couple of current interests makes the pre-run hello less awkward.",
    placeholder:
      "e.g. Trying new coffee spots, cooking after long runs, and learning guitar badly but happily.",
    previewLabel: "Off-run lately",
    suggestions: ["Coffee spots", "Cooking", "Live music", "Weekend walks"],
    Icon: TrailIcon,
  },
  {
    name: "interests",
    title: "What could you happily chat about on an easy run?",
    microcopy: "Think low-pressure topics for the moments between pace checks.",
    placeholder:
      "e.g. Films, travel stories, football, local food places, or whatever podcast I just got hooked on.",
    previewLabel: "Easy-run chat",
    suggestions: ["Films and TV", "Travel stories", "Food places", "Podcasts"],
    Icon: ChatIcon,
  },
];

/**
 * Appends a suggestion chip to an existing free-text value, inserting a sensible
 * joiner and capping the length. Returns the value unchanged when the suggestion
 * is already present (case-insensitive).
 */
export function appendSuggestion(
  current: string,
  suggestion: string,
  max: number = MAX_VIBE_LENGTH,
): string {
  const value = current.trim();
  if (value.toLowerCase().includes(suggestion.toLowerCase())) return current;
  const joiner = value ? (/[.!?]$/.test(value) ? " " : ", ") : "";
  return `${value}${joiner}${suggestion}`.slice(0, max);
}

export function SparkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2z" />
      <path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16z" />
    </svg>
  );
}

export function TrailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 18c3 0 3-4 6-4s3 4 6 4 3-4 6-4" />
      <path d="M4 10c3 0 3-4 6-4s3 4 6 4 3-4 6-4" />
    </svg>
  );
}

export function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 1 1 18-4z" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  );
}
