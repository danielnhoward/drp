"use server";

import { revalidatePath } from "next/cache";

import { deleteAvatarFile, saveAvatarFile } from "@/lib/avatars";
import { isGender, type Gender } from "@/lib/gender";
import {
  requireUser,
  updateUserAvatar,
  updateUserProfile,
} from "@/lib/users";

export type ProfileFormState = { error?: string; ok?: boolean };

export type AvatarFormState = { error?: string; ok?: boolean };

// Matches "M:SS" or "MM:SS" — minutes 1–2 digits, seconds always 2.
const MMSS = /^(\d{1,2}):([0-5]\d)$/;

function parseMMSS(value: string): number | null {
  const match = MMSS.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

// Optional free-text fields are capped so a single profile can't store an
// unbounded blob. Generous enough for a few sentences each.
const MAX_ABOUT_LENGTH = 500;

// Trims an optional text field to null when blank. Returns the field's error
// message if it exceeds the length cap, otherwise the cleaned value.
function parseOptionalText(
  value: string,
  label: string,
): { value: string | null } | { error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { value: null };
  if (trimmed.length > MAX_ABOUT_LENGTH) {
    return { error: `Keep ${label} under ${MAX_ABOUT_LENGTH} characters.` };
  }
  return { value: trimmed };
}

export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "").trim();
  const genderRaw = String(formData.get("gender") ?? "").trim();
  const fiveKRaw = String(formData.get("fiveKTime") ?? "").trim();
  const whyRunRaw = String(formData.get("whyRun") ?? "");
  const hobbiesRaw = String(formData.get("hobbies") ?? "");
  const interestsRaw = String(formData.get("interests") ?? "");

  if (!name) return { error: "Enter your name." };

  if (!dateOfBirth) return { error: "Enter your date of birth." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return { error: "Enter a valid date of birth." };
  }
  if (dateOfBirth > new Date().toISOString().slice(0, 10)) {
    return { error: "Date of birth can't be in the future." };
  }

  if (!genderRaw) return { error: "Pick a gender." };
  if (!isGender(genderRaw)) return { error: "Pick a valid gender option." };
  const gender: Gender = genderRaw;

  // Pace is optional. When provided it's collected as a 5k time and stored as
  // seconds-per-km, mirroring the availability form; a blank field clears it.
  let preferredPaceSeconds: number | null = null;
  if (fiveKRaw) {
    const fiveK = parseMMSS(fiveKRaw);
    if (fiveK === null || fiveK <= 0) {
      return { error: "Enter your 5k time as mm:ss (e.g. 22:30)." };
    }
    preferredPaceSeconds = Math.round(fiveK / 5);
  }

  const whyRun = parseOptionalText(whyRunRaw, "why you run with others");
  if ("error" in whyRun) return { error: whyRun.error };
  const hobbies = parseOptionalText(hobbiesRaw, "your hobbies");
  if ("error" in hobbies) return { error: hobbies.error };
  const interests = parseOptionalText(interestsRaw, "your interests");
  if ("error" in interests) return { error: interests.error };

  updateUserProfile(user.id, {
    name,
    dateOfBirth,
    gender,
    preferredPaceSeconds,
    whyRun: whyRun.value,
    hobbies: hobbies.value,
    interests: interests.value,
  });

  revalidatePath("/profile");
  revalidatePath("/");
  return { ok: true };
}

export async function updateAvatarAction(
  _prev: AvatarFormState,
  formData: FormData,
): Promise<AvatarFormState> {
  const user = await requireUser();

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pick an image to upload." };
  }

  const result = await saveAvatarFile(user.id, file);
  if ("error" in result) return { error: result.error };

  updateUserAvatar(user.id, result.url);
  revalidatePath("/profile");
  // Refresh anywhere else that displays avatars so they pick up the new URL.
  revalidatePath("/");
  return { ok: true };
}

export async function removeAvatarAction(): Promise<void> {
  const user = await requireUser();
  await deleteAvatarFile(user.id);
  updateUserAvatar(user.id, null);
  revalidatePath("/profile");
  revalidatePath("/");
}
