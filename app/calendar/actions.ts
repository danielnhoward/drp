"use server";

import { revalidatePath } from "next/cache";

import { createAvailability, deleteAvailability } from "@/lib/availability";

export type AddAvailabilityState = { error?: string; ok?: boolean };

export async function addAvailabilityAction(
  _prev: AddAvailabilityState,
  formData: FormData,
): Promise<AddAvailabilityState> {
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  const distanceKm = Number(formData.get("distanceKm"));
  const paceMinSeconds = Number(formData.get("paceMinSeconds"));
  const paceMaxSeconds = Number(formData.get("paceMaxSeconds"));
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
  if (
    !Number.isInteger(paceMinSeconds) ||
    !Number.isInteger(paceMaxSeconds) ||
    paceMinSeconds <= 0 ||
    paceMaxSeconds <= 0
  ) {
    return { error: "Enter a valid pace range." };
  }
  if (paceMinSeconds >= paceMaxSeconds) {
    return { error: "The faster end of the pace range must be lower than the slower end." };
  }
  // A missing field reads back as null; Number(null) is 0, which would slip
  // through a plain isFinite check, so reject empty values explicitly.
  if (!latRaw || !lonRaw || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { error: "Enter a valid latitude and longitude." };
  }

  await createAvailability({
    startTime,
    endTime,
    distanceKm,
    paceMinSeconds,
    paceMaxSeconds,
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
    await deleteAvailability(id);
    revalidatePath("/calendar");
  }
}
