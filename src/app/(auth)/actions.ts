"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { appBaseUrl } from "@/lib/urls";
import { resolvePostLoginPath } from "@/lib/auth";

const credentials = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export type AuthState = {
  error?: string;
  info?: string;
  confirmEmail?: string;
  // Set when signUp detects the email already has an account, so the UI can
  // offer a login link and a password-reset link instead of a dead end.
  accountExists?: boolean;
};

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
  redirect(await resolvePostLoginPath());
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
  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      return { error: "That email already has an account.", accountExists: true };
    }
    return { error: error.message };
  }

  // Supabase's anti-enumeration behaviour: re-signing up an email that
  // already has a CONFIRMED account returns no error, but the returned
  // user's identities array is empty (a brand-new signup always has one
  // identity). Same underlying case as the explicit error above, just a
  // different shape depending on the project's confirm-email setting.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "That email already has an account.", accountExists: true };
  }

  // No session means email confirmation is on — show the "check your inbox"
  // screen instead of a silent nothing.
  if (!data.session) return { confirmEmail: parsed.data.email };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// Google via Supabase OAuth — an ADDITION alongside signIn/signUp above, not
// a replacement. Existing email+password accounts are completely untouched:
// this only ever creates a NEW auth path for whoever clicks the button: the
// existing credentials flow (signIn/signUp) is not modified by its presence.
// Reuses the exact same /auth/callback route email confirmation links
// already use — Supabase's OAuth redirect is the same
// code-in-the-URL -> exchangeCodeForSession() shape, so nothing there needed
// to change either.
export async function signInWithGoogle(
  _prev: AuthState,
  _formData: FormData,
): Promise<AuthState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${baseUrl()}/auth/callback` },
  });
  if (error || !data.url) {
    return { error: "Couldn't start Google sign-in. Try again, or use email below." };
  }
  redirect(data.url);
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
