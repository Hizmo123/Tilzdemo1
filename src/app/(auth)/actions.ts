"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { appBaseUrl } from "@/lib/urls";

const credentials = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export type AuthState = { error?: string; info?: string; confirmEmail?: string };

// Shared with QR/invite links so every outbound URL resolves to the deployed
// host on Vercel instead of localhost.
const baseUrl = appBaseUrl;

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Kept generic on purpose (don't reveal which field was wrong), but the
    // login page adds a hint about email confirmation for new accounts.
    return { error: "Email or password is incorrect." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${baseUrl()}/auth/callback` },
  });
  if (error) return { error: error.message };

  // No session means email confirmation is on — show the "check your inbox"
  // screen instead of a silent nothing.
  if (!data.session) return { confirmEmail: parsed.data.email };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function resendConfirmation(email: string): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${baseUrl()}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { info: "Sent again — check your inbox and spam folder." };
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!z.string().email().safeParse(email).success)
    return { error: "Enter a valid email address." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl()}/auth/callback?next=/reset-password`,
  });
  // Always report success to avoid revealing whether the email is registered.
  return {
    info: "If that email has an account, a reset link is on its way.",
  };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Couldn't update your password. Try the link again." };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
