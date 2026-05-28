"use server";

import { redirect } from "next/navigation";

import { isGender, type Gender } from "@/lib/gender";
import {
  clearSession,
  createUser,
  findUserByEmail,
  isProfileComplete,
  setSessionUser,
  updateUserProfile,
} from "@/lib/users";
import type { AuthStage, AuthState } from "./state";

// Matches "M:SS" or "MM:SS" — minutes 1–2 digits, seconds always 2.
const MMSS = /^(\d{1,2}):([0-5]\d)$/;

function parseMMSS(value: string): number | null {
  const match = MMSS.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatMMSS(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export async function authAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "").trim();
  const genderRaw = String(formData.get("gender") ?? "").trim();
  const fiveKRaw = String(formData.get("fiveKTime") ?? "").trim();
  // The form's hidden "stage" input tells us which stage was rendered when
  // the user clicked submit.
  const stage: AuthStage =
    formData.get("stage") === "profile" ? "profile" : "email";

  // Carry whatever the user typed back into the next render so a validation
  // error doesn't blank the form.
  const retained = {
    email,
    name,
    dateOfBirth,
    gender: isGender(genderRaw) ? genderRaw : ("" as const),
    fiveKTime: fiveKRaw,
  };

  if (!email) return { ...retained, stage, error: "Enter your email." };
  if (!email.includes("@")) {
    return { ...retained, stage, error: "Enter a valid email." };
  }

  const existing = findUserByEmail(email);

  // Stage 1: just an email. Decide which path to send the user down.
  if (stage === "email") {
    if (!existing) {
      // Brand new — expand the form so they can fill in the profile.
      return { ...retained, stage: "profile" };
    }
    if (!isProfileComplete(existing)) {
      // Returning legacy user with NULL fields: sign them in and ask them to
      // finish their profile on the same screen.
      await setSessionUser(existing.id);
      return {
        ...retained,
        stage: "profile",
        name: existing.name,
        dateOfBirth: existing.dateOfBirth ?? "",
        gender:
          existing.gender && isGender(existing.gender) ? existing.gender : "",
        fiveKTime:
          existing.preferredPaceSeconds !== null
            ? formatMMSS(existing.preferredPaceSeconds * 5)
            : "",
      };
    }
    await setSessionUser(existing.id);
    redirect("/");
  }

  // Stage 2: profile fields submitted. If the email is now a known complete
  // account (user edited the field), treat it as a sign-in and ignore the
  // profile inputs.
  if (existing && isProfileComplete(existing)) {
    await setSessionUser(existing.id);
    redirect("/");
  }

  if (!name) return { ...retained, stage: "profile", error: "Enter your name." };
  if (!dateOfBirth) {
    return {
      ...retained,
      stage: "profile",
      error: "Enter your date of birth.",
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return {
      ...retained,
      stage: "profile",
      error: "Enter a valid date of birth.",
    };
  }
  if (dateOfBirth > new Date().toISOString().slice(0, 10)) {
    return {
      ...retained,
      stage: "profile",
      error: "Date of birth can't be in the future.",
    };
  }
  if (!genderRaw) {
    return { ...retained, stage: "profile", error: "Pick a gender." };
  }
  if (!isGender(genderRaw)) {
    return {
      ...retained,
      stage: "profile",
      error: "Pick a valid gender option.",
    };
  }
  const gender: Gender = genderRaw;

  if (!fiveKRaw) {
    return {
      ...retained,
      stage: "profile",
      error: "Enter your comfortable 5k time.",
    };
  }
  const fiveK = parseMMSS(fiveKRaw);
  if (fiveK === null || fiveK <= 0) {
    return {
      ...retained,
      stage: "profile",
      error: "Enter your 5k time as mm:ss (e.g. 22:30).",
    };
  }
  const preferredPaceSeconds = Math.round(fiveK / 5);

  if (existing) {
    // Existing but incomplete — fill in their profile.
    updateUserProfile(existing.id, {
      name,
      dateOfBirth,
      gender,
      preferredPaceSeconds,
    });
    await setSessionUser(existing.id);
  } else {
    const user = createUser({
      email,
      name,
      dateOfBirth,
      gender,
      preferredPaceSeconds,
    });
    await setSessionUser(user.id);
  }

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}
