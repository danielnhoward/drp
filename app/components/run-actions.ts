"use server";

import { revalidatePath } from "next/cache";

import {
  addRunParticipantMessage,
  finishRun,
  isRunParticipant,
  getRunParticipantMessage,
  updateRunParticipantMessage,
  clearRunParticipantMessage,
  unfinishRun,
  updateRunPhoto,
} from "@/lib/runs";
import { publishRunMessageUpdated } from "../../lib/realtime";
import { saveRunRatings, type RunRatingInput } from "@/lib/ratings";
import { saveRunPhotoFile } from "@/lib/run-photos";
import { requireUser } from "@/lib/users";

export type RunPhotoState = { error?: string; ok?: boolean };
export type RunMessageState = { error?: string; ok?: boolean; message?: string | null };

const MAX_RUN_MESSAGE_LENGTH = 500;
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

/**
 * Stores or updates a short note for the current user on a run.
 * If a message already exists, we update it so users can edit their message.
 */
export async function addRunMessageAction(
  _prev: RunMessageState,
  formData: FormData,
): Promise<RunMessageState> {
  const id = Number(formData.get("runId"));
  if (!Number.isFinite(id)) return { error: "Something went wrong." };

  const user = await requireUser();
  if (!isRunParticipant(id, user.id)) {
    return { error: "You're not part of this run." };
  }

  const existing = getRunParticipantMessage(id, user.id);

  const message = String(formData.get("message") ?? "").trim();
  if (!message) {
    return { error: "Enter a message." };
  }
  if (message.length > MAX_RUN_MESSAGE_LENGTH) {
    return { error: `Keep your message under ${MAX_RUN_MESSAGE_LENGTH} characters.` };
  }

  let stored = false;
  if (existing === null) {
    stored = addRunParticipantMessage(id, user.id, message);
  } else {
    stored = updateRunParticipantMessage(id, user.id, message);
  }
  if (!stored) return { error: "Unable to save your message." };

  publishRunMessageUpdated(id, user.id, message);

  revalidatePath("/");
  return { ok: true, message };
}

export async function clearRunMessageAction(
  _prev: RunMessageState,
  formData: FormData,
): Promise<RunMessageState> {
  const id = Number(formData.get("runId"));
  if (!Number.isFinite(id)) return { error: "Something went wrong." };

  const user = await requireUser();
  if (!isRunParticipant(id, user.id)) {
    return { error: "You're not part of this run." };
  }

  const cleared = clearRunParticipantMessage(id, user.id);
  if (!cleared) return { error: "Unable to clear your message." };

  publishRunMessageUpdated(id, user.id, null);
  revalidatePath("/");
  return { ok: true, message: null };
}
