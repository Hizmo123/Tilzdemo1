"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn, type AuthState } from "../actions";
import { createClient } from "@/lib/supabase/client";
import { Label, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { GoogleSignInButton } from "../google-sign-in-button";
import { FormError } from "../form-error";

const initial: AuthState = {};

export default function LoginPage() {
  const [state, action] = useActionState(signIn, initial);
  const router = useRouter();
  const [pkPending, startPk] = useTransition();
  const [pkError, setPkError] = useState<string | null>(null);

  function signInWithPasskey() {
    setPkError(null);
    startPk(async () => {
      try {
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.auth as any).signInWithPasskey();
        if (error) {
          setPkError("Passkey sign-in failed. Use your password instead.");
        } else {
          router.push("/dashboard");
          router.refresh();
        }
      } catch {
        setPkError("Passkey sign-in isn't available here. Use your password.");
      }
    });
  }

  const invalid = !!state.error;

  return (
    <>
      <h1 className="font-display text-display-sm font-semibold">Log in</h1>
      <p className="text-sm text-muted mt-1 mb-6">Welcome back to your dashboard.</p>

      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" invalid={invalid} required />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-pine hover:underline mb-1.5">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            invalid={invalid}
            required
          />
        </div>

        <div className={state.error ? "" : "hidden"}>
          <FormError>{state.error}</FormError>
          {state.error && (
            <p className="text-xs text-muted mt-1.5">
              Just signed up? Confirm your email first — check your inbox for the link.
            </p>
          )}
        </div>

        <SubmitButton pendingLabel="Logging in…">Log in</SubmitButton>
      </form>

      <div className="flex items-center gap-3 my-5">
        <span className="flex-1 h-px bg-line" />
        <span className="text-xs text-muted">or</span>
        <span className="flex-1 h-px bg-line" />
      </div>

      <div className="space-y-2">
        <GoogleSignInButton />
        <Button variant="secondary" full onClick={signInWithPasskey} loading={pkPending}>
          {pkPending ? "Waiting for your device…" : "Sign in with fingerprint / Face ID"}
        </Button>
      </div>
      <div className={pkError ? "mt-2" : ""}>
        <FormError>{pkError}</FormError>
      </div>

      <p className="text-sm text-muted mt-6 text-center">
        No account?{" "}
        <Link href="/signup" className="text-pine font-medium hover:underline">
          Create one
        </Link>
      </p>
    </>
  );
}
