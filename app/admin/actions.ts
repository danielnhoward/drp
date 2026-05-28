"use server";

import { redirect } from "next/navigation";

import { setSessionUser, clearSession } from "@/lib/users";

export async function impersonateAction(formData: FormData): Promise<void> {
  const userId = Number(formData.get("userId"));
  if (!Number.isInteger(userId) || userId <= 0) return;
  await setSessionUser(userId);
  redirect("/");
}

export async function adminLogoutAction(): Promise<void> {
  await clearSession();
  redirect("/admin");
}
