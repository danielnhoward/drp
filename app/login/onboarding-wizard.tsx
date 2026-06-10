"use client";

import Image from "next/image";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { GENDERS, GENDER_LABELS } from "@/lib/gender";
import { formatMMSSInput, MMSS } from "@/lib/profile-fields";
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
  "h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-base text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent";
const textareaClass =
  "min-h-28 w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-base text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent";
const compactTextareaClass =
  "min-h-20 w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-base text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent";
const chipClass =
  "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-left text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent disabled:opacity-50";
// Pace presets are single-choice quick-fills (they replace the field), so they
// read as a selectable radio group - no "+" icon, and the active one is filled.
const pacePresetClass =
  "inline-flex min-h-8 max-w-full items-center justify-center rounded-full border border-border bg-surface-2 px-3.5 py-1 text-center text-sm font-medium text-muted transition-colors hover:border-accent/40 hover:bg-accent/10 hover:text-accent disabled:opacity-50";
const pacePresetSelectedClass =
  "inline-flex min-h-8 max-w-full items-center justify-center rounded-full border border-accent bg-accent px-3.5 py-1 text-center text-sm font-medium text-accent-contrast transition-colors disabled:opacity-50";
const primaryBtn =
  "btn-accent tap rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50";
const secondaryBtn =
  "btn-ghost tap rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-50";
const ghostBtn =
  "btn-ghost tap rounded-full px-4 py-2.5 text-sm font-medium";

function vibePromptFor(step: StepId): VibePrompt | undefined {
  return VIBE_PROMPTS.find((prompt) => prompt.name === step);
}

// Touch devices get native date dropdowns; pointer devices get the typed
// inputs. Read via useSyncExternalStore so SSR renders the desktop variant
// and the client reconciles without a setState-in-effect cascade.
function useIsTouch() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(pointer: coarse)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
}

function isEditableElement(element: Element | null): element is HTMLElement {
  return element instanceof HTMLElement && element.matches(editableSelector);
}

function usePhoneKeyboardOpen() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const phoneWidth = window.matchMedia("(max-width: 640px)");
    const viewport = window.visualViewport;
    let fullViewportHeight = viewport?.height ?? window.innerHeight;
    let frame = 0;
    let timeout = 0;

    function update() {
      const hasEditableFocus = isEditableElement(document.activeElement);
      const viewportHeight = viewport?.height ?? window.innerHeight;

      if (viewportHeight > fullViewportHeight || !hasEditableFocus) {
        fullViewportHeight = Math.max(fullViewportHeight, viewportHeight);
      }

      const viewportGap = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      const viewportShrink = Math.max(0, fullViewportHeight - viewportHeight);
      const viewportSuggestsKeyboard =
        !viewport || viewportGap > 90 || viewportShrink > 90;

      setIsOpen(
        coarsePointer.matches &&
          phoneWidth.matches &&
          hasEditableFocus &&
          viewportSuggestsKeyboard,
      );
    }

    function scheduleUpdate() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(update, 260);
    }

    scheduleUpdate();
    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    coarsePointer.addEventListener("change", scheduleUpdate);
    phoneWidth.addEventListener("change", scheduleUpdate);
    document.addEventListener("focusin", scheduleUpdate);
    document.addEventListener("focusout", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      viewport?.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      coarsePointer.removeEventListener("change", scheduleUpdate);
      phoneWidth.removeEventListener("change", scheduleUpdate);
      document.removeEventListener("focusin", scheduleUpdate);
      document.removeEventListener("focusout", scheduleUpdate);
    };
  }, []);

  return isOpen;
}

const dobSelectClass =
  "h-11 rounded-lg border border-black/10 bg-white px-3 text-base text-black outline-none focus:border-black/40 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-white/50";
const editableSelector =
  'input:not([type="hidden"]):not([type="file"]), textarea, select';

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function DobStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const [day, setDay] = useState(parts ? String(parseInt(parts[3], 10)) : "");
  const [month, setMonth] = useState(parts ? String(parseInt(parts[2], 10)) : "");
  const [year, setYear] = useState(parts ? parts[1] : "");
  const isTouch = useIsTouch();

  const dayInputRef = useRef<HTMLInputElement>(null);
  const mmRef = useRef<HTMLInputElement>(null);
  const yyyyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isTouch) dayInputRef.current?.focus();
  }, [isTouch]);

  function commit(d: string, m: string, y: string) {
    const dn = parseInt(d, 10);
    const mn = parseInt(m, 10);
    const yn = parseInt(y, 10);
    if (d && m && y.length === 4 && dn >= 1 && dn <= 31 && mn >= 1 && mn <= 12 && yn >= 1900) {
      onChange(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    } else {
      onChange("");
    }
  }

  function handleDay(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    const n = parseInt(digits, 10);
    const clamped = digits && n > 31 ? "31" : digits;
    setDay(clamped);
    commit(clamped, month, year);
    if (clamped.length === 2) mmRef.current?.focus();
  }

  function handleMonth(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    const n = parseInt(digits, 10);
    const clamped = digits && n > 12 ? "12" : digits;
    setMonth(clamped);
    commit(day, clamped, year);
    if (clamped.length === 2) yyyyRef.current?.focus();
  }

  function handleYear(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    const n = parseInt(digits, 10);
    const maxYear = new Date().getFullYear();
    const clamped = digits.length === 4 && n > maxYear ? String(maxYear) : digits;
    setYear(clamped);
    commit(day, month, clamped);
  }

  if (isTouch) {
    const currentYear = new Date().getFullYear();
    return (
      <div className="flex gap-2">
        <select
          className={`${dobSelectClass} w-20 min-w-0`}
          value={day}
          onChange={(e) => { const v = e.target.value; setDay(v); commit(v, month, year); }}
        >
          <option value="" disabled>DD</option>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>{i + 1}</option>
          ))}
        </select>
        <select
          className={`${dobSelectClass} flex-1 min-w-0`}
          value={month}
          onChange={(e) => { const v = e.target.value; setMonth(v); commit(day, v, year); }}
        >
          <option value="" disabled>Month</option>
          {MONTH_NAMES.map((name, i) => (
            <option key={i + 1} value={String(i + 1)}>{name}</option>
          ))}
        </select>
        <select
          className={`${dobSelectClass} w-24 min-w-0`}
          value={year}
          onChange={(e) => { const v = e.target.value; setYear(v); commit(day, month, v); }}
        >
          <option value="" disabled>YYYY</option>
          {Array.from({ length: currentYear - 1899 }, (_, i) => {
            const y = String(currentYear - i);
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        ref={dayInputRef}
        className={`${dobSelectClass} w-16 min-w-0`}
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="DD"
        value={day}
        onChange={(e) => handleDay(e.target.value)}
      />
      <input
        ref={mmRef}
        className={`${dobSelectClass} w-16 min-w-0`}
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="MM"
        value={month}
        onChange={(e) => handleMonth(e.target.value)}
      />
      <input
        ref={yyyyRef}
        className={`${dobSelectClass} flex-1 min-w-0`}
        type="text"
        inputMode="numeric"
        maxLength={4}
        placeholder="YYYY"
        value={year}
        onChange={(e) => handleYear(e.target.value)}
      />
    </div>
  );
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
  const keyboardCompact = usePhoneKeyboardOpen();

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
  const isAutoAdvance = step === "gender" || step === "ranBefore";
  const firstName = values.name.trim().split(/\s+/)[0] ?? "";
  const hasOptionalContent = isOptional && optionalStepHasValue(step);
  const advanceButtonLabel = isOptional && !hasOptionalContent ? "Skip" : "Continue";
  const advanceButtonClass =
    isOptional && !hasOptionalContent ? secondaryBtn : primaryBtn;
  const currentTextareaClass = keyboardCompact
    ? compactTextareaClass
    : textareaClass;
  const avatarSizeClass = keyboardCompact ? "h-28 w-28" : "h-40 w-40";
  const avatarTextClass = keyboardCompact ? "text-4xl" : "text-5xl";
  const cameraBadgeClass = keyboardCompact
    ? "bottom-0 right-0 h-8 w-8"
    : "bottom-1 right-1 h-9 w-9";
  const cameraIconClass = keyboardCompact ? "h-4 w-4" : "h-5 w-5";

  // Revoke the preview object URL when it's replaced or the component unmounts.
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  useEffect(() => {
    if (!keyboardCompact) return;

    document.body.classList.add("signup-keyboard-open");
    return () => document.body.classList.remove("signup-keyboard-open");
  }, [keyboardCompact]);

  function setValue<K extends keyof OnboardingValues>(
    key: K,
    value: OnboardingValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function selectGender(gender: OnboardingValues["gender"]) {
    setStepError(null);
    setValue("gender", gender);
    advance();
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
    advance();
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
    const target = event.target as HTMLElement;
    if (target.tagName === "TEXTAREA") return;
    if (isLast) return;
    if (isAutoAdvance) {
      if (target.tagName === "BUTTON") return;
      event.preventDefault();
      return;
    }
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
      className={`mx-auto flex w-full max-w-md flex-1 flex-col px-6 ${
        keyboardCompact ? "py-3" : "py-8"
      }`}
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

      <Progress
        current={stepIndex + 1}
        total={steps.length}
        compact={keyboardCompact}
      />

      {/* Clip wrapper: the inner step slides in from 64px off-axis, so this
          keeps the overshoot from briefly extending the page. */}
      <div
        className={`flex flex-1 flex-col overflow-hidden ${
          keyboardCompact ? "mt-4" : "mt-8"
        }`}
      >
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

      <div
        className={`flex items-center justify-between gap-3 ${
          keyboardCompact ? "mt-4 pb-1" : "mt-8"
        }`}
      >
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
          ) : isAutoAdvance ? null : isLast ? (
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
            compact={keyboardCompact}
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
            compact={keyboardCompact}
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
            compact={keyboardCompact}
            title={firstName ? `When's your birthday, ${firstName}?` : "When's your birthday?"}
            subtitle="We use your age to help suggest comfortable running partners."
          >
            <DobStep
              value={values.dateOfBirth}
              onChange={(v) => setValue("dateOfBirth", v)}
            />
          </StepHeader>
        );

      case "gender":
        return (
          <StepHeader
            compact={keyboardCompact}
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
                    onClick={() => selectGender(option)}
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

      case "ranBefore": {
        const options: { value: "yes" | "no"; label: string }[] = [
          { value: "yes", label: "Yes, I've run before" },
          { value: "no", label: "No, I'm just starting out" },
        ];
        return (
          <StepHeader
            compact={keyboardCompact}
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
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border bg-surface text-foreground hover:border-accent/40"
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
            compact={keyboardCompact}
            title="Help your running partner recognise you"
            subtitle="It does not need to be a running photo. A picture helps the person you are matched with feel like they are meeting a real person, and you can change or remove it later."
          >
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`group relative shrink-0 cursor-pointer rounded-full transition hover:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${avatarSizeClass}`}
                aria-label={avatarPreview ? "Change profile picture" : "Upload profile picture"}
              >
                {avatarPreview ? (
                  <Image
                    src={avatarPreview}
                    alt="Your selected profile picture"
                    width={keyboardCompact ? 112 : 160}
                    height={keyboardCompact ? 112 : 160}
                    unoptimized
                    className={`${avatarSizeClass} rounded-full border border-border object-cover`}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className={`flex items-center justify-center rounded-full border border-border bg-surface-2 font-semibold text-muted ${avatarSizeClass} ${avatarTextClass}`}
                  >
                    {values.name.charAt(0) || "?"}
                  </span>
                )}
                {/* Camera badge — bottom-right corner */}
                <span
                  aria-hidden="true"
                  className={`absolute flex items-center justify-center rounded-full bg-accent shadow-md ring-2 ring-background ${cameraBadgeClass}`}
                >
                  <CameraIcon className={`${cameraIconClass} text-accent-contrast`} />
                </span>
              </button>
              {avatarPreview && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="tap inline-flex h-9 cursor-pointer items-center rounded-md border border-border px-3 text-sm font-medium text-danger hover:bg-surface-2"
                >
                  Remove photo
                </button>
              )}
              <p className="text-xs text-muted">
                Tap to {avatarPreview ? "change" : "add a photo"} · JPEG, PNG, or WebP · up to 5 MB
              </p>
            </div>
          </StepHeader>
        );

      case "pace":
        return (
          <StepHeader
            compact={keyboardCompact}
            title={firstName ? `What's your conversational 5k time, ${firstName}?` : "What's your conversational 5k time?"}
            subtitle="The time you could hold a conversation at, not your race-day best. We use it to match you with runners at a similar rhythm."
            optional
          >
            <p className="mb-2 text-xs font-medium text-muted">
              Common times
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {PACE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={values.fiveKTime.trim() === preset}
                  onClick={() => setValue("fiveKTime", preset)}
                  className={
                    values.fiveKTime.trim() === preset ? pacePresetSelectedClass : pacePresetClass
                  }
                >
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
              onChange={(event) =>
                setValue("fiveKTime", formatMMSSInput(event.target.value))
              }
            />
            <p className="mt-2 text-xs text-muted">
              Pick one above or type your own as mm:ss.
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
          <StepHeader
            compact={keyboardCompact}
            title={copy.title}
            subtitle={copy.microcopy}
            optional
          >
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
              className={currentTextareaClass}
              rows={keyboardCompact ? 3 : 4}
              maxLength={MAX_VIBE_LENGTH}
              placeholder={copy.placeholder}
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
        const added = [
          avatarPreview ? "profile photo" : null,
          values.fiveKTime.trim() ? `5k time (${values.fiveKTime.trim()})` : null,
          values.whyRun.trim() ? "why you run" : null,
          values.hobbies.trim() ? "hobbies" : null,
          values.interests.trim() ? "chat topics" : null,
        ].filter((item): item is string => item !== null);
        return (
          <StepHeader
            compact={keyboardCompact}
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

function Progress({
  current,
  total,
  compact = false,
}: {
  current: number;
  total: number;
  compact?: boolean;
}) {
  return (
    <div>
      <p className={`${compact ? "text-[11px]" : "text-xs"} font-medium text-muted`}>
        Step <span className="font-mono tnum">{current}</span> of{" "}
        <span className="font-mono tnum">{total}</span>
      </p>
      <div
        className={`overflow-hidden rounded-full bg-surface-2 ${
          compact ? "mt-1 h-1" : "mt-2 h-1.5"
        }`}
      >
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
  optional = false,
  compact = false,
  children,
}: {
  title: string;
  subtitle?: string;
  optional?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col ${compact ? "gap-3" : "gap-4"}`}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1
            className={`text-gradient font-semibold tracking-tight ${
              compact ? "text-xl" : "text-2xl"
            }`}
          >
            {title}
          </h1>
          {optional && (
            <span className="inline-flex shrink-0 items-center rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
              Optional
            </span>
          )}
        </div>
        {subtitle && (
          <p className={`${compact ? "mt-1 text-xs" : "mt-2 text-sm"} text-muted`}>
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

function CameraIcon({ className }: { className?: string }) {
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
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
