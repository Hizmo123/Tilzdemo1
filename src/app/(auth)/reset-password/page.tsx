"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword, type AuthState } from "../actions";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

const initial: AuthState = {};

// Reached from the password-reset email link, which lands on /auth/callback and
// establishes a temporary recovery session before redirecting here.
export default function ResetPasswordPage() {
  const [state, action] = useActionState(updatePassword, initial);

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Set a new password
      </h1>
      <p className="text-sm text-muted mt-1 mb-6">
        Choose a new password for your account.
      </p>

      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          <p className="text-xs text-muted mt-1.5">At least 8 characters.</p>
        </div>

        {state.error && (
          <div>
            <FormMessage tone="error">{state.error}</FormMessage>
            <p className="text-xs text-muted mt-1.5">
              If this keeps failing, request a fresh link from{" "}
              <Link href="/forgot-password" className="text-pine hover:underline">
                Forgot password
              </Link>
              .
            </p>
          </div>
        )}

        <SubmitButton pendingLabel="Saving…">Save new password</SubmitButton>
      </form>
    </>
  );
}
