"use server";

import { revalidatePath } from "next/cache";

import { finishRun } from "@/lib/runs";
import { requireUser } from "@/lib/users";

export async function finishRunAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("runId"));
  if (!Number.isFinite(id)) return;
  const user = await requireUser();
  await finishRun(id, user.id);
  revalidatePath("/");
}
