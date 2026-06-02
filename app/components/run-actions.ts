"use server";

import { revalidatePath } from "next/cache";

import {
  finishRun,
  isRunParticipant,
  unfinishRun,
  updateRunPhoto,
} from "@/lib/runs";
import { saveRunPhotoFile } from "@/lib/run-photos";
import { requireUser } from "@/lib/users";

export type RunPhotoState = { error?: string; ok?: boolean };

/**
 * Marks the run finished for the current user. Returns `promptForPhoto: true`
 * for the first participant to finish — they're asked to add the group photo.
 */
export async function finishRunAction(
  runId: number,
): Promise<{ promptForPhoto: boolean }> {
  if (!Number.isFinite(runId)) return { promptForPhoto: false };
  const user = await requireUser();
  const { isFirstFinisher } = await finishRun(runId, user.id);

  if (isFirstFinisher) {
    // Don't revalidate yet: doing so would drop this run from the home page and
    // unmount the photo prompt before it can show. The follow-up upload/cancel
    // action refreshes the page once the photo step is done.
    return { promptForPhoto: true };
  }

  revalidatePath("/");
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
  revalidatePath("/");
  return { ok: true };
}
