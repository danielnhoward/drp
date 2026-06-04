"use server";

import { revalidatePath } from "next/cache";

import {
  finishRun,
  isRunParticipant,
  unfinishRun,
  updateRunPhoto,
} from "@/lib/runs";
import { saveRunRatings, type RunRatingInput } from "@/lib/ratings";
import { saveRunPhotoFile } from "@/lib/run-photos";
import { requireUser } from "@/lib/users";

export type RunPhotoState = { error?: string; ok?: boolean };
export type RunRatingsState = { error?: string; ok?: boolean };

/**
 * Marks the run finished for the current user. Returns `promptForPhoto: true`
 * for the first participant to finish. The modal collects the photo/rating
 * follow-ups before revalidating, so the run card stays mounted during the flow.
 */
export async function finishRunAction(
  runId: number,
): Promise<{ promptForPhoto: boolean }> {
  if (!Number.isFinite(runId)) return { promptForPhoto: false };
  const user = await requireUser();
  const { isFirstFinisher } = await finishRun(runId, user.id);

  if (isFirstFinisher) {
    return { promptForPhoto: true };
  }

  return { promptForPhoto: false };
}

/**
 * The first finisher declined to take the group photo: undo their finish so the
 * run stays on their home page and the next participant to finish is prompted
 * instead.
 */
export async function cancelRunPhotoAction(runId: number): Promise<void> {
  if (!Number.isFinite(runId)) return;
  const user = await requireUser();
  await unfinishRun(runId, user.id);
  revalidatePath("/");
}

export async function uploadRunPhotoAction(
  _prev: RunPhotoState,
  formData: FormData,
): Promise<RunPhotoState> {
  const id = Number(formData.get("runId"));
  if (!Number.isFinite(id)) return { error: "Something went wrong." };
  const user = await requireUser();
  // Only a participant of the run may set its photo — runId comes from the
  // client, so don't trust it without this check.
  if (!isRunParticipant(id, user.id)) {
    return { error: "You're not part of this run." };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pick a photo to upload." };
  }

  const result = await saveRunPhotoFile(id, file);
  if ("error" in result) return { error: result.error };

  updateRunPhoto(id, result.url);
  return { ok: true };
}

export async function submitRunRatingsAction(
  _prev: RunRatingsState,
  formData: FormData,
): Promise<RunRatingsState> {
  const runId = Number(formData.get("runId"));
  if (!Number.isInteger(runId) || runId <= 0) {
    return { error: "Something went wrong." };
  }

  const ratings: RunRatingInput[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("rating-")) continue;
    const ratedUserId = Number(key.slice("rating-".length));
    const stars = Number(value);
    ratings.push({
      ratedUserId,
      stars,
    });
  }

  const user = await requireUser();
  try {
    saveRunRatings(runId, user.id, ratings);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not save those ratings.",
    };
  }

  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true };
}
