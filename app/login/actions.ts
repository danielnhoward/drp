"use server";

import { redirect } from "next/navigation";

import { findOrCreateUser, setSessionUser, clearSession } from "@/lib/users";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!email) return { error: "Enter your email." };
  // Loose enough to allow anything with an @ — the schema enforces uniqueness
  // case-insensitively, real validation isn't worth it for this demo flow.
  if (!email.includes("@")) return { error: "Enter a valid email." };
  if (!name) return { error: "Enter your name." };

  const user = findOrCreateUser(email, name);
  await setSessionUser(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}
