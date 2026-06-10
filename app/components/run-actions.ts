"use server";

import { revalidatePath } from "next/cache";

import {
  addRunParticipantMessage,
  finishRun,
  getCoachedRunSession,
  isRunParticipant,
  getRunParticipantMessage,
  updateRunParticipantMessage,
  clearRunParticipantMessage,
  unfinishRun,
  updateRunPhoto,
} from "@/lib/runs";
import { publishRunMessageUpdated } from "../../lib/realtime";
import {
  DIFFICULTY_OPTIONS,
  planOutcome,
  type CoachDifficulty,
} from "@/lib/coach";
import { saveRunRatings, type RunRatingInput } from "@/lib/ratings";
import { saveRunPhotoFile } from "@/lib/run-photos";
import { graduateUser, requireUser, setCoachSessionIndex } from "@/lib/users";

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

export type CoachFeedbackState =
  | { graduated: boolean; nextSessionIndex: number }
  | { error: string };

/**
 * The final, coach-specific step of finishing a coached training run: records
 * how it felt and advances the runner's Couch-to-5K progress. By the time this
 * runs the run is already finished (finishRunAction) and partners rated, so it
 * doesn't touch the run itself. Returns whether they graduated (and the next
 * plan session otherwise) so the finish UI can show the right follow-up.
 */
export async function recordCoachFeedbackAction(
  runId: number,
  difficulty: CoachDifficulty,
): Promise<CoachFeedbackState> {
  if (!Number.isFinite(runId)) return { error: "Something went wrong." };
  if (!DIFFICULTY_OPTIONS.some((option) => option.value === difficulty)) {
    return { error: "Let us know how the run felt." };
  }

  const user = await requireUser();
  if (!isRunParticipant(runId, user.id)) {
    return { error: "You're not part of this run." };
  }
  const session = getCoachedRunSession(runId);
  if (session === null) return { error: "That isn't a coached run." };

  const { graduated, nextIndex } = planOutcome(session, difficulty);
  if (graduated) {
    graduateUser(user.id);
  } else {
    setCoachSessionIndex(user.id, nextIndex);
  }

  // No revalidation here: the result/congrats screen lives on the still-mounted
  // run card, and revalidating any path invalidates the root layout's soft tag
  // and refreshes the current "/" route, unmounting the screen before the runner
  // reads it. The result buttons navigate with a full page load, so home, /coach,
  // /calendar and the nav all pick up the new state fresh.
  return { graduated, nextSessionIndex: nextIndex };
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

  // A coached run continues to a difficulty step (then a result screen) on the
  // same, still-mounted run card. Any revalidate here invalidates the root
  // layout's soft tag and refreshes the current "/" route, which would unmount
  // the card mid-flow — so skip revalidation entirely for coached runs. The
  // finish is already persisted; the coach result screen navigates with a full
  // page load, and home/profile are force-dynamic so they refetch on next view.
  if (getCoachedRunSession(runId) === null) {
    revalidatePath("/");
    revalidatePath("/profile");
  }
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
