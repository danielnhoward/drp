"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isPastDateTime, isoToday } from "@/lib/format-date";
import { getMostRecentCoachedRunDate, scheduleCoachedRun } from "@/lib/runs";
import { requireUser } from "@/lib/users";

export type CoachScheduleState = { error?: string };

/**
 * Schedules the beginner's next coached run from the /plan quick-schedule form.
 * Distance and the plan note come from the program (their current session), so
 * the form only collects when (date + window) and where (lat/lon). Mirrors the
 * validation in app/schedule/actions.ts, minus the distance/pace fields.
 */
export async function scheduleCoachedRunAction(
  _prev: CoachScheduleState,
  formData: FormData,
): Promise<CoachScheduleState> {
  const user = await requireUser();
  // Coached scheduling is only for runners actively in the program.
  if (user.coachStatus !== "active") redirect("/");

  const date = String(formData.get("date") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  const latRaw = formData.get("lat");
  const lonRaw = formData.get("lon");
  const lat = Number(latRaw);
  const lon = Number(lonRaw);

  if (!date) return { error: "Pick a date." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Enter a valid date." };
  if (date < isoToday()) return { error: "The date can't be in the past." };
  if (!startTime || !endTime) {
    return { error: "Pick both a start and end time." };
  }
  if (endTime <= startTime) {
    return { error: "The end time must be after the start time." };
  }
  // Reject a window whose start has already passed (e.g. earlier today). Keeping
  // the start in the future also guarantees the run's midpoint time is upcoming,
  // so the scheduled run shows on the home page's next-24-hours list.
  if (isPastDateTime(date, startTime)) {
    return { error: "The start time can't be in the past." };
  }
  // Number(null) is 0, which would pass a plain isFinite check, so reject empties.
  if (!latRaw || !lonRaw || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { error: "Pick a location on the map." };
  }
  // Nudge a rest day: don't let a beginner stack a second coached run onto the
  // same day as their last one.
  const lastCoachedDate = getMostRecentCoachedRunDate(user.id);
  if (lastCoachedDate && date <= lastCoachedDate) {
    return {
      error: "Give yourself a rest day — pick a date after your last run.",
    };
  }

  await scheduleCoachedRun(
    user.id,
    { date, startTime, endTime, lat, lon },
    user.coachSessionIndex ?? 0,
  );

  // Revalidate home (where the run shows once it's within 24h) but return to
  // /plan, which now shows a "Next run booked" confirmation. Sending the user
  // straight to home was confusing: a run scheduled more than 24h out isn't on
  // the next-24-hours list yet, so home read as "nothing happened".
  revalidatePath("/");
  revalidatePath("/plan");
  redirect("/plan");
}
