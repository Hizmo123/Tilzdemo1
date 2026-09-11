"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type AuthState } from "../actions";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

const initial: AuthState = {};

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, initial);

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Reset your password
      </h1>
      <p className="text-sm text-muted mt-1 mb-6">
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>

      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>

        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        {state.info && <FormMessage tone="info">{state.info}</FormMessage>}

        <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
      </form>

      <p className="text-sm text-muted mt-6 text-center">
        <Link href="/login" className="text-pine font-medium hover:underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}
