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
  BEGINNER_VIBE_COPY,
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
  // True when a new runner arrived from the landing page with their email
  // already entered: it's prefilled in initialValues, so the "email" step is
  // dropped here too (without the resuming label changes — they're still
  // creating an account, not finishing one).
  skipEmailStep?: boolean;
  initialValues: OnboardingValues;
};

// Mirror lib/avatars.ts so the file picker filters the right types up front and
// an oversize selection fails fast in the browser.
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

const fieldClass =
  "h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-base text-black outline-none focus:border-black/40 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white/50";
const textareaClass =
  "min-h-28 w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-base text-black outline-none focus:border-black/40 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white/50";
const chipClass =
  "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-black/10 bg-zinc-50 px-3 py-1 text-left text-xs font-medium text-zinc-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-blue-900/80 dark:hover:bg-blue-950/40 dark:hover:text-blue-200";
const primaryBtn =
  "inline-flex min-w-24 items-center justify-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50";
const secondaryBtn =
  "inline-flex min-w-24 items-center justify-center rounded-full border border-black/15 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-white/20 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900";
const ghostBtn =
  "rounded-full px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50";

function vibePromptFor(step: StepId): VibePrompt | undefined {
  return VIBE_PROMPTS.find((prompt) => prompt.name === step);
}

export default function OnboardingWizard({
  resuming,
  skipEmailStep = false,
  initialValues,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  // Which way the last navigation went, so the incoming step slides in from the
  // matching side ("scrolling" forward to the next question / back to the last).
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [values, setValues] = useState<OnboardingValues>(initialValues);
  const [stepError, setStepError] = useState<string | null>(null);

  // The step list is derived from the answers so far. The email is dropped when
  // it's already settled — a resuming user's row, or one handed over from the
  // landing page (skipEmailStep) — and a beginner who hasn't run before skips
  // the pace question. "ranBefore" sits before "pace", so changing the answer
  // never invalidates the current stepIndex.
  const steps = STEP_ORDER.filter((step) => {
    if (step === "email" && (resuming || skipEmailStep)) return false;
    if (step === "pace" && values.ranBefore === "no") return false;
    return true;
  });
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
  const hasOptionalContent = isOptional && optionalStepHasValue(step);
  const advanceButtonLabel = isOptional && !hasOptionalContent ? "Skip" : "Continue";
  const advanceButtonClass =
    isOptional && !hasOptionalContent ? secondaryBtn : primaryBtn;

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

  // Answering "No" skips the pace step, so clear any pace already entered (e.g.
  // the user picked Yes, typed a time, then came back and switched to No) — they
  // can no longer see or edit it, and beginners shouldn't submit one.
  function setRanBefore(answer: "yes" | "no") {
    setStepError(null);
    setValues((current) => ({
      ...current,
      ranBefore: answer,
      fiveKTime: answer === "no" ? "" : current.fiveKTime,
    }));
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

  function optionalStepHasValue(currentStep: StepId) {
    switch (currentStep) {
      case "photo":
        return Boolean(avatarPreview);
      case "pace":
        return Boolean(values.fiveKTime.trim());
      case "whyRun":
        return Boolean(values.whyRun.trim());
      case "hobbies":
        return Boolean(values.hobbies.trim());
      case "interests":
        return Boolean(values.interests.trim());
      default:
        return false;
    }
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
    if (step === "ranBefore" && !values.ranBefore) {
      return setStepError("Let us know if you've run before.");
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
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
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
              className={advanceButtonClass}
            >
              {advanceButtonLabel}
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
                ? "Lovely to have you here. This is the display name other runners will see, a nickname or first name is perfectly fine."
                : "Pick a display name other runners will see, a nickname or just your first name is perfectly fine."
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
              // color-scheme lets the browser draw the native calendar-picker
              // glyph per the active theme: black in light mode, white in dark.
              className={`${fieldClass} [color-scheme:light_dark]`}
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
                    className={`flex h-12 items-center rounded-lg border px-4 text-left text-sm font-medium transition-colors ${
                      selected
                        ? "border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-500/70 dark:bg-blue-950/40 dark:text-blue-200"
                        : "border-black/10 bg-white text-zinc-800 hover:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-white/40"
                    }`}
                  >
                    {GENDER_LABELS[option]}
                  </button>
                );
              })}
            </div>
          </StepHeader>
        );

      case "ranBefore": {
        const options: { value: "yes" | "no"; label: string }[] = [
          { value: "yes", label: "Yes, I've run before" },
          { value: "no", label: "No, I'm just starting out" },
        ];
        return (
          <StepHeader
            title="Have you run before?"
            subtitle="No experience needed — this just helps us ask the right questions next."
          >
            <div className="flex flex-col gap-2">
              {options.map((option) => {
                const selected = values.ranBefore === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRanBefore(option.value)}
                    aria-pressed={selected}
                    className={`flex h-12 items-center rounded-lg border px-4 text-left text-sm font-medium transition-colors ${
                      selected
                        ? "border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-500/70 dark:bg-blue-950/40 dark:text-blue-200"
                        : "border-black/10 bg-white text-zinc-800 hover:border-black/30 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-white/40"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </StepHeader>
        );
      }

      case "photo":
        return (
          <StepHeader
            title="Help your running partner recognise you"
            subtitle="It does not need to be a running photo. A picture helps the person you are matched with feel like they are meeting a real person, and you can change or remove it later."
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
                    className="h-24 w-24 rounded-full border border-black/10 object-cover dark:border-white/15"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-24 w-24 items-center justify-center rounded-full border border-black/10 bg-zinc-100 text-3xl font-semibold text-zinc-500 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    {values.name.charAt(0) || "?"}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex h-9 items-center rounded-md border border-black/15 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-white/20 dark:hover:bg-zinc-900"
                >
                  {avatarPreview ? "Change" : "Choose photo"}
                </button>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="inline-flex h-9 items-center rounded-md border border-black/15 px-3 text-sm font-medium text-red-600 hover:bg-zinc-50 dark:border-white/20 dark:text-red-400 dark:hover:bg-zinc-900"
                  >
                    Remove
                  </button>
                )}
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  JPEG, PNG, or WebP. Up to 5 MB.
                </p>
              </div>
            </div>
          </StepHeader>
        );

      case "pace":
        return (
          <StepHeader
            title={firstName ? `What's your conversational 5k time, ${firstName}?` : "What's your conversational 5k time?"}
            subtitle="Think conversational pace, not race-day pace. We use it to match you with runners at a similar rhythm."
            optional
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
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
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
        // Beginners (No branch) see reframed copy for whyRun/hobbies while
        // reusing the same chips and field; interests is shared as-is.
        const copy =
          values.ranBefore === "no" && step !== "interests"
            ? BEGINNER_VIBE_COPY[step]
            : prompt;
        return (
          <StepHeader title={copy.title} subtitle={copy.microcopy} optional>
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
              placeholder={copy.placeholder}
              value={value}
              onChange={(event) =>
                setValue(prompt.name, event.target.value.slice(0, MAX_VIBE_LENGTH))
              }
            />
            <p className="mt-2 text-right text-xs text-zinc-500 dark:text-zinc-400">
              {value.length}/{MAX_VIBE_LENGTH}
            </p>
          </StepHeader>
        );
      }

      case "review": {
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
            <dl className="flex flex-col gap-2 rounded-lg border border-black/10 bg-zinc-50 p-4 text-sm dark:border-white/15 dark:bg-zinc-900">
              <ReviewRow label="Email" value={values.email} />
              <ReviewRow label="Date of birth" value={values.dateOfBirth} />
              <ReviewRow
                label="Gender"
                value={values.gender ? GENDER_LABELS[values.gender] : ""}
              />
            </dl>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
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
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="font-medium text-zinc-900 dark:text-zinc-50">
        {value || "—"}
      </dd>
    </div>
  );
}

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Step {current} of {total}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function StepHeader({
  title,
  subtitle,
  optional = false,
  children,
}: {
  title: string;
  subtitle?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {optional && (
            <span className="inline-flex shrink-0 items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
              Optional
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
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
