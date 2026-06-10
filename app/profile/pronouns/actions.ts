"use server";

import { revalidatePath } from "next/cache";

import { parsePronouns } from "@/lib/pronouns";
import { requireCompleteUser, updateUserPronouns } from "@/lib/users";

export type PronounsFormState = { error?: string; ok?: boolean };

export async function updatePronounsAction(
  _prev: PronounsFormState,
  formData: FormData,
): Promise<PronounsFormState> {
  const user = await requireCompleteUser();
  const parsed = parsePronouns(String(formData.get("pronouns") ?? ""));

  if ("error" in parsed) return { error: parsed.error };

  updateUserPronouns(user.id, parsed.value);
  revalidatePath("/profile");
  revalidatePath("/profile/pronouns");
  revalidatePath("/");
  return { ok: true };
}
