"use client";

import Image from "next/image";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import { GENDERS, GENDER_LABELS } from "@/lib/gender";
import { MMSS } from "@/lib/profile-fields";
import {
  appendSuggestion,
  MAX_VIBE_LENGTH,
  PACE_PRESETS,
  VIBE_PROMPTS,
  type VibePrompt,
} from "@/app/profile/profile-content";
import { completeOnboardingAction, lookupEmailAction } from "./actions";
import {
  INITIAL_COMPLETE_STATE,
  OPTIONAL_STEPS,
  STEP_ORDER,
  type OnboardingValues,
  type StepId,
} from "./state";

type Props = {
  // True when a signed-in user is finishing an incomplete profile: their email
  // is already known, so the wizard drops the "email" step.
  resuming: boolean;
  initialValues: OnboardingValues;
};

// Mirror lib/avatars.ts so the file picker filters the right types up front and
// an oversize selection fails fast in the browser.
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

const fieldClass =
  "h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent";
const textareaClass =
  "min-h-28 w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-base text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent";
const chipClass =
  "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-left text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent disabled:opacity-50";
const primaryBtn =
  "btn-accent tap rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50";
const ghostBtn =
  "btn-ghost tap rounded-full px-4 py-2.5 text-sm font-medium";

function vibePromptFor(step: StepId): VibePrompt | undefined {
  return VIBE_PROMPTS.find((prompt) => prompt.name === step);
}

export default function OnboardingWizard({ resuming, initialValues }: Props) {
  // A resuming user already supplied their email; drop that step for them.
  const steps = resuming
    ? STEP_ORDER.filter((step) => step !== "email")
    : STEP_ORDER;

  const [stepIndex, setStepIndex] = useState(0);
  // Which way the last navigation went, so the incoming step slides in from the
  // matching side ("scrolling" forward to the next question / back to the last).
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [values, setValues] = useState<OnboardingValues>(initialValues);
  const [stepError, setStepError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [emailPending, startEmailTransition] = useTransition();
  const [serverState, formAction, pending] = useActionState(
    completeOnboardingAction,
    INITIAL_COMPLETE_STATE,
  );

  // The server validates again and points us back at the offending step on
  // failure; jump there (during render, the React-sanctioned way) so its error
  // shows next to the field. Guarded against the previous result so it runs once
  // per new submission rather than looping.
  const [handledState, setHandledState] = useState(serverState);
  if (serverState !== handledState) {
    setHandledState(serverState);
    if (serverState.step) {
      const target = steps.indexOf(serverState.step);
      if (target >= 0) {
        setDirection("prev");
        setStepIndex(target);
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isOptional = OPTIONAL_STEPS.has(step);
  const isEmail = step === "email";
  const firstName = values.name.trim().split(/\s+/)[0] ?? "";

  // Revoke the preview object URL when it's replaced or the component unmounts.
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  function setValue<K extends keyof OnboardingValues>(
    key: K,
    value: OnboardingValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function back() {
    setStepError(null);
    setDirection("prev");
    setStepIndex((index) => Math.max(0, index - 1));
  }

  function advance() {
    setStepError(null);
    setDirection("next");
    setStepIndex((index) => Math.min(steps.length - 1, index + 1));
  }

  function continueFromEmail() {
    setEmailError(null);
    const email = values.email.trim();
    if (!email) return setEmailError("Enter your email.");
    if (!email.includes("@")) return setEmailError("Enter a valid email.");

    startEmailTransition(async () => {
      // A returning, complete account is signed in and redirected by the action,
      // so control never returns here for that case.
      const result = await lookupEmailAction(email);
      if (result.status === "error") {
        setEmailError(result.error);
        return;
      }
      if (result.status === "resume") {
        setValues((current) => ({ ...current, ...result.values }));
      }
      advance();
    });
  }

  // "Continue" on a required step — validate before moving on.
  function nextRequired() {
    setStepError(null);
    if (step === "name" && !values.name.trim()) {
      return setStepError("Enter your name.");
    }
    if (step === "dateOfBirth") {
      if (!values.dateOfBirth) {
        return setStepError("Enter your date of birth.");
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(values.dateOfBirth)) {
        return setStepError("Enter a valid date of birth.");
      }
      if (values.dateOfBirth > today) {
        return setStepError("Date of birth can't be in the future.");
      }
    }
    if (step === "gender" && !values.gender) {
      return setStepError("Pick a gender.");
    }
    advance();
  }

  // "Continue" on an optional step — skip validates nothing, this checks the
  // pace format if one was typed.
  function nextOptional() {
    setStepError(null);
    if (step === "pace") {
      const time = values.fiveKTime.trim();
      if (time && !MMSS.test(time)) {
        return setStepError("Enter your 5k time as mm:ss (e.g. 22:30).");
      }
    }
    advance();
  }

  function onPickAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setStepError(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (!file) {
      setAvatarPreview(null);
      return;
    }
    if (!ACCEPTED_TYPES.split(",").includes(file.type)) {
      setAvatarPreview(null);
      setStepError("Use a JPEG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setAvatarPreview(null);
      setStepError("Image is too large — keep it under 5 MB.");
      event.target.value = "";
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
  }

  function removeAvatar() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // Keep Enter from submitting the whole form mid-wizard — treat it as the
  // step's primary action instead. Textareas keep their newline behaviour.
  function onFormKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter") return;
    if ((event.target as HTMLElement).tagName === "TEXTAREA") return;
    if (isLast) return;
    event.preventDefault();
    if (isEmail) continueFromEmail();
    else if (isOptional) nextOptional();
    else nextRequired();
  }

  const serverError =
    serverState.step === step ? serverState.error : undefined;
  const error = isEmail ? emailError : (stepError ?? serverError);

  return (
    <form
      action={formAction}
      onKeyDown={onFormKeyDown}
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-8"
    >
      {/* Every value travels in the final submit, whichever step we're on. */}
      <input type="hidden" name="email" value={values.email} />
      <input type="hidden" name="name" value={values.name} />
      <input type="hidden" name="dateOfBirth" value={values.dateOfBirth} />
      <input type="hidden" name="gender" value={values.gender} />
      <input type="hidden" name="fiveKTime" value={values.fiveKTime} />
      <input type="hidden" name="whyRun" value={values.whyRun} />
      <input type="hidden" name="hobbies" value={values.hobbies} />
      <input type="hidden" name="interests" value={values.interests} />
      {/* Mounted on every step so the chosen file survives navigation. */}
      <input
        ref={fileRef}
        type="file"
        name="avatar"
        accept={ACCEPTED_TYPES}
        onChange={onPickAvatar}
        className="sr-only"
      />

      <Progress current={stepIndex + 1} total={steps.length} />

      {/* Clip wrapper: the inner step slides in from 64px off-axis, so this
          keeps the overshoot from briefly extending the page. */}
      <div className="mt-8 flex flex-1 flex-col overflow-hidden">
        {/* Re-keyed per step so each screen swipes in fresh — up from below
            moving forward, down from above going back. */}
        <div
          key={step}
          className={`flex flex-1 flex-col ${
            direction === "next" ? "anim-step-up" : "anim-step-down"
          }`}
        >
          {renderStep()}

          {error && (
            <p className="mt-4 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <div>
          {stepIndex > 0 && (
            <button type="button" onClick={back} className={ghostBtn}>
              Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOptional && !isLast && (
            <button type="button" onClick={advance} className={ghostBtn}>
              Skip for now
            </button>
          )}
          {isEmail ? (
            // Shares the "advance" key with the Continue button below so the
            // node is reused between advancing steps (focus stays on it).
            <button
              key="advance"
              type="button"
              onClick={continueFromEmail}
              disabled={emailPending}
              className={primaryBtn}
            >
              {emailPending ? "Checking…" : "Continue"}
            </button>
          ) : isLast ? (
            // Distinct key from the advancing buttons: React mounts this as a
            // fresh, UNFOCUSED element rather than reusing the Continue node, so
            // an Enter carried over from advancing (e.g. held/repeated) can't
            // land on the submit and finish the wizard without a real click.
            <button
              key="submit"
              type="submit"
              disabled={pending}
              className={primaryBtn}
            >
              {pending
                ? resuming
                  ? "Saving…"
                  : "Creating…"
                : resuming
                  ? "Finish"
                  : "Create account"}
            </button>
          ) : (
            <button
              key="advance"
              type="button"
              onClick={isOptional ? nextOptional : nextRequired}
              className={primaryBtn}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </form>
  );

  function renderStep() {
    switch (step) {
      case "email":
        return (
          <StepHeader
            title="What's your email?"
            subtitle="We'll use this to find your account or help you create one."
          >
            <input
              className={fieldClass}
              type="email"
              autoComplete="email"
              autoFocus
              value={values.email}
              onChange={(event) => setValue("email", event.target.value)}
            />
          </StepHeader>
        );

      case "name":
        return (
          <StepHeader
            title={firstName ? `Hi, ${firstName}.` : "What should we call you?"}
            subtitle={
              firstName
                ? "Lovely to have you here. Other runners will see this name when you're matched."
                : "This is the name other runners will see."
            }
          >
            <input
              className={fieldClass}
              type="text"
              autoComplete="name"
              autoFocus
              value={values.name}
              onChange={(event) => setValue("name", event.target.value)}
            />
          </StepHeader>
        );

      case "dateOfBirth":
        return (
          <StepHeader
            title={firstName ? `When's your birthday, ${firstName}?` : "When's your birthday?"}
            subtitle="We use your age to help suggest comfortable running partners."
          >
            <input
              // The dark theme's global color-scheme draws the native
              // calendar-picker glyph light so it reads on the dark input.
              className={fieldClass}
              type="date"
              max={today}
              value={values.dateOfBirth}
              onChange={(event) => setValue("dateOfBirth", event.target.value)}
            />
          </StepHeader>
        );

      case "gender":
        return (
          <StepHeader
            title="How do you identify?"
            subtitle="Pick the option that feels right for your profile."
          >
            <div className="flex flex-col gap-2">
              {GENDERS.map((option) => {
                const selected = values.gender === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setValue("gender", option)}
                    aria-pressed={selected}
                    className={`tap flex h-12 items-center rounded-lg border px-4 text-left text-sm font-medium transition-colors ${
                      selected
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border bg-surface text-foreground hover:border-accent/40"
                    }`}
                  >
                    {GENDER_LABELS[option]}
                  </button>
                );
              })}
            </div>
          </StepHeader>
        );

      case "photo":
        return (
          <StepHeader
            title="Add a profile photo"
            subtitle="Totally optional, but it can help your running partner spot you at the meeting point."
          >
            <div className="flex items-center gap-4">
              <div className="relative h-24 w-24 shrink-0">
                {avatarPreview ? (
                  <Image
                    src={avatarPreview}
                    alt="Your selected profile picture"
                    width={96}
                    height={96}
                    unoptimized
                    className="h-24 w-24 rounded-full border border-border object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-24 w-24 items-center justify-center rounded-full border border-border bg-surface-2 text-3xl font-semibold text-muted"
                  >
                    {values.name.charAt(0) || "?"}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="tap inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-surface-2"
                >
                  {avatarPreview ? "Change" : "Choose photo"}
                </button>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="tap inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-danger hover:bg-surface-2"
                  >
                    Remove
                  </button>
                )}
                <p className="text-xs text-muted">
                  JPEG, PNG, or WebP. Up to 5 MB.
                </p>
              </div>
            </div>
          </StepHeader>
        );

      case "pace":
        return (
          <StepHeader
            title={firstName ? `What's your easy 5k pace, ${firstName}?` : "What's your easy 5k pace?"}
            subtitle="Think conversational pace, not race-day pace. We use it to match you with runners at a similar rhythm."
          >
            <div className="mb-3 flex flex-wrap gap-2">
              {PACE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setValue("fiveKTime", preset)}
                  className={chipClass}
                >
                  <PlusIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{preset}</span>
                </button>
              ))}
            </div>
            <input
              className={fieldClass}
              type="text"
              placeholder="22:30"
              pattern="\d{1,2}:[0-5]\d"
              inputMode="numeric"
              value={values.fiveKTime}
              onChange={(event) => setValue("fiveKTime", event.target.value)}
            />
            <p className="mt-2 text-xs text-muted">
              Tap a time or type your own as mm:ss.
            </p>
          </StepHeader>
        );

      // The three free-text "running vibe" prompts share one renderer.
      case "whyRun":
      case "hobbies":
      case "interests": {
        const prompt = vibePromptFor(step);
        if (!prompt) return null;
        const value = values[prompt.name];
        return (
          <StepHeader title={prompt.title} subtitle={prompt.microcopy}>
            <div className="mb-3 flex flex-wrap gap-2">
              {prompt.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() =>
                    setValue(
                      prompt.name,
                      appendSuggestion(value, suggestion, MAX_VIBE_LENGTH),
                    )
                  }
                  className={chipClass}
                >
                  <PlusIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{suggestion}</span>
                </button>
              ))}
            </div>
            <textarea
              className={textareaClass}
              rows={4}
              maxLength={MAX_VIBE_LENGTH}
              placeholder={prompt.placeholder}
              value={value}
              onChange={(event) =>
                setValue(prompt.name, event.target.value.slice(0, MAX_VIBE_LENGTH))
              }
            />
            <p className="mt-2 text-right text-xs text-muted">
              <span className="font-mono tnum">{value.length}/{MAX_VIBE_LENGTH}</span>
            </p>
          </StepHeader>
        );
      }

      case "review": {
        const name = values.name.trim();
        const added = [
          avatarPreview ? "profile photo" : null,
          values.fiveKTime.trim() ? `5k time (${values.fiveKTime.trim()})` : null,
          values.whyRun.trim() ? "why you run" : null,
          values.hobbies.trim() ? "hobbies" : null,
          values.interests.trim() ? "chat topics" : null,
        ].filter((item): item is string => item !== null);
        return (
          <StepHeader
            title={firstName ? `You're all set, ${firstName}.` : "You're all set."}
            subtitle="Create your account and we'll start finding runs that fit your schedule. Anything you skipped can be added later from your profile."
          >
            <dl className="card flex flex-col gap-2 p-4 text-sm">
              <ReviewRow label="Email" value={values.email} />
              <ReviewRow label="Date of birth" value={values.dateOfBirth} />
              <ReviewRow
                label="Gender"
                value={values.gender ? GENDER_LABELS[values.gender] : ""}
              />
            </dl>
            <p className="text-sm text-muted">
              {added.length > 0
                ? `Also added: ${added.join(", ")}.`
                : "You skipped the optional extras — no problem, add them anytime."}
            </p>
          </StepHeader>
        );
      }

      default:
        return null;
    }
  }
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-foreground">
        {value || "—"}
      </dd>
    </div>
  );
}

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted">
        Step <span className="font-mono tnum">{current}</span> of{" "}
        <span className="font-mono tnum">{total}</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function StepHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-gradient text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-sm text-muted">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
