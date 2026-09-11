"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { signUp, resendConfirmation, type AuthState } from "../actions";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

const initial: AuthState = {};

export default function SignupPage() {
  const [state, action] = useActionState(signUp, initial);

  // Confirmation screen — shown when Supabase requires email confirmation.
  if (state.confirmEmail) {
    return <ConfirmScreen email={state.confirmEmail} />;
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Create your account
      </h1>
      <p className="text-sm text-muted mt-1 mb-6">
        Set up your restaurant in a few minutes. It&apos;s free to start.
      </p>

      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          <p className="text-xs text-muted mt-1.5">At least 8 characters.</p>
        </div>

        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

        <SubmitButton pendingLabel="Creating…">Create account</SubmitButton>
      </form>

      <p className="text-sm text-muted mt-6 text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-pine font-medium hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}

function ConfirmScreen({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="text-center">
      <div className="w-14 h-14 rounded-full bg-pine-soft text-pine-deep flex items-center justify-center mx-auto mb-4 text-2xl">
        ✉
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Check your inbox
      </h1>
      <p className="text-sm text-muted mt-2">
        We sent a confirmation link to{" "}
        <span className="font-medium text-ink">{email}</span>. Click it to
        activate your account, then log in.
      </p>
      <p className="text-xs text-muted mt-3">
        Can&apos;t find it? Check your spam folder.
      </p>

      {msg && <p className="text-sm text-pine-deep mt-4">{msg}</p>}
      {err && <p className="text-sm text-danger mt-4">{err}</p>}

      <button
        disabled={pending}
        onClick={() => {
          setErr(null);
          setMsg(null);
          start(async () => {
            const res = await resendConfirmation(email);
            if (res.error) setErr(res.error);
            else setMsg(res.info ?? "Sent.");
          });
        }}
        className="mt-5 text-sm rounded-lg border border-line px-4 py-2 hover:border-ink/30 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Resend email"}
      </button>

      <p className="text-sm text-muted mt-6">
        <Link href="/login" className="text-pine font-medium hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
