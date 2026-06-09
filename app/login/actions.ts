"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { saveAvatarFile } from "@/lib/avatars";
import { isGender, type Gender } from "@/lib/gender";
import {
  formatMMSS,
  paceSecondsFromFiveK,
  parseOptionalText,
} from "@/lib/profile-fields";
import {
  clearSession,
  createUser,
  findUserByEmail,
  isProfileComplete,
  setSessionUser,
  updateUserAvatar,
  updateUserProfile,
} from "@/lib/users";
import type { CompleteState, EmailLookup } from "./state";

/**
 * First step of the wizard: the user typed an email. Decide which path they're
 * on without yet creating anything.
 *
 * - Returning, fully-onboarded account → sign in and redirect home (this case
 *   never returns to the client).
 * - Returning account with missing required fields → sign in so the final
 *   submit can update their row, and hand back what we already know to prefill.
 * - Brand-new email → tell the wizard to carry on collecting details.
 */
export async function lookupEmailAction(emailRaw: string): Promise<EmailLookup> {
  const email = emailRaw.trim();
  if (!email) return { status: "error", error: "Enter your email." };
  if (!email.includes("@")) {
    return { status: "error", error: "Enter a valid email." };
  }

  const existing = findUserByEmail(email);
  if (!existing) return { status: "new" };

  if (isProfileComplete(existing)) {
    await setSessionUser(existing.id);
    redirect("/");
  }

  await setSessionUser(existing.id);
  return {
    status: "resume",
    values: {
      email: existing.email,
      name: existing.name,
      dateOfBirth: existing.dateOfBirth ?? "",
      gender:
        existing.gender && isGender(existing.gender) ? existing.gender : "",
      fiveKTime:
        existing.preferredPaceSeconds !== null
          ? formatMMSS(existing.preferredPaceSeconds * 5)
          : "",
      whyRun: existing.whyRun ?? "",
      hobbies: existing.hobbies ?? "",
      interests: existing.interests ?? "",
    },
  };
}

/**
 * Final step: every answer arrives at once. Creates the account (or fills in a
 * resuming user's row), persists the optional fields, stores the avatar if one
 * was chosen, then drops the user onto the home page. On a validation failure it
 * returns the offending `step` so the wizard can jump straight back to it.
 */
export async function completeOnboardingAction(
  _prev: CompleteState,
  formData: FormData,
): Promise<CompleteState> {
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "").trim();
  const genderRaw = String(formData.get("gender") ?? "").trim();
  const fiveKRaw = String(formData.get("fiveKTime") ?? "").trim();
  const whyRunRaw = String(formData.get("whyRun") ?? "");
  const hobbiesRaw = String(formData.get("hobbies") ?? "");
  const interestsRaw = String(formData.get("interests") ?? "");
  const avatar = formData.get("avatar");

  // The email identifies the account in every case: a resuming user carries
  // their own (the wizard hides the email step for them, so it can't drift),
  // and a new signup carries what they typed. Resolving by email — rather than
  // by whatever session lookupEmailAction may have set — avoids updating the
  // wrong row if someone backs up and edits the email.
  if (!email) return { error: "Enter your email.", step: "email" };
  if (!email.includes("@")) {
    return { error: "Enter a valid email.", step: "email" };
  }
  const existing = findUserByEmail(email);

  // The email points at a finished account (e.g. they went back and changed it
  // to an existing one) — treat the whole thing as a sign-in.
  if (existing && isProfileComplete(existing)) {
    await setSessionUser(existing.id);
    redirect("/");
  }

  if (!name) return { error: "Enter your name.", step: "name" };
  if (!dateOfBirth) {
    return { error: "Enter your date of birth.", step: "dateOfBirth" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return { error: "Enter a valid date of birth.", step: "dateOfBirth" };
  }
  if (dateOfBirth > new Date().toISOString().slice(0, 10)) {
    return {
      error: "Date of birth can't be in the future.",
      step: "dateOfBirth",
    };
  }
  if (!genderRaw) return { error: "Pick a gender.", step: "gender" };
  if (!isGender(genderRaw)) {
    return { error: "Pick a valid gender option.", step: "gender" };
  }
  const gender: Gender = genderRaw;

  // Optional fields — collected as a 5k time / free text, validated leniently.
  const pace = paceSecondsFromFiveK(fiveKRaw);
  if ("error" in pace) return { error: pace.error, step: "pace" };
  const whyRun = parseOptionalText(whyRunRaw, "why you run with others");
  if ("error" in whyRun) return { error: whyRun.error, step: "whyRun" };
  const hobbies = parseOptionalText(hobbiesRaw, "your hobbies");
  if ("error" in hobbies) return { error: hobbies.error, step: "hobbies" };
  const interests = parseOptionalText(interestsRaw, "your interests");
  if ("error" in interests) return { error: interests.error, step: "interests" };

  // Create the row for a new user; either way write the full field set (the
  // create only inserts the required columns, so the optional ones land here).
  const userId = existing
    ? existing.id
    : createUser({ email, name, dateOfBirth, gender }).id;
  updateUserProfile(userId, {
    name,
    dateOfBirth,
    gender,
    preferredPaceSeconds: pace.value,
    whyRun: whyRun.value,
    hobbies: hobbies.value,
    interests: interests.value,
  });
  await setSessionUser(userId);

  // Optional avatar: only now do we have a user id to file it under. The client
  // already checks type/size, so a failure here is rare; returning it points the
  // wizard back at the photo step, and the (now signed-in) user can retry — the
  // resubmit takes the update path, so nothing is duplicated.
  if (avatar instanceof File && avatar.size > 0) {
    const result = await saveAvatarFile(userId, avatar);
    if ("error" in result) return { error: result.error, step: "photo" };
    updateUserAvatar(userId, result.url);
  }

  revalidatePath("/");
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/welcome");
}
