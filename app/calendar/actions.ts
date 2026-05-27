"use server";

import { revalidatePath } from "next/cache";

import {
  createAvailability,
  deleteAvailability,
  SKILL_LEVELS,
  type SkillLevel,
} from "@/lib/availability";

export type AddAvailabilityState = { error?: string; ok?: boolean };

export async function addAvailabilityAction(
  _prev: AddAvailabilityState,
  formData: FormData,
): Promise<AddAvailabilityState> {
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  const distanceKm = Number(formData.get("distanceKm"));
  const skillLevel = String(formData.get("skillLevel") ?? "");
  const partnerPref = String(formData.get("partnerPref") ?? "").trim() || "Random";
  const latRaw = formData.get("lat");
  const lonRaw = formData.get("lon");
  const lat = Number(latRaw);
  const lon = Number(lonRaw);

  if (!startTime || !endTime) {
    return { error: "Pick both a start and end time." };
  }
  // Times are "HH:MM" strings, which compare correctly lexicographically.
  if (endTime <= startTime) {
    return { error: "The end time must be after the start time." };
  }
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return { error: "Enter a distance greater than 0 km." };
  }
  if (!SKILL_LEVELS.includes(skillLevel as SkillLevel)) {
    return { error: "Choose a skill level." };
  }
  // A missing field reads back as null; Number(null) is 0, which would slip
  // through a plain isFinite check, so reject empty values explicitly.
  if (!latRaw || !lonRaw || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      error: "We couldn't read your current location — allow location access and try again.",
    };
  }

  createAvailability({
    startTime,
    endTime,
    distanceKm,
    skillLevel,
    partnerPref,
    lat,
    lon,
  });

  revalidatePath("/calendar");
  return { ok: true };
}

export async function deleteAvailabilityAction(
  formData: FormData,
): Promise<void> {
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) {
    deleteAvailability(id);
    revalidatePath("/calendar");
  }
}
