"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { signUp, resendConfirmation, type AuthState } from "../actions";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { GoogleSignInButton } from "../google-sign-in-button";

const initial: AuthState = {};
const RESEND_COOLDOWN_SECONDS = 30;

export default function SignupPage() {
  const [state, action] = useActionState(signUp, initial);
  // Lets "Wrong email? Edit it" return to the form pre-filled, without
  // waiting for a new server action call to clear state.confirmEmail.
  const [editingAfterConfirm, setEditingAfterConfirm] = useState(false);

  if (state.confirmEmail && !editingAfterConfirm) {
    return (
      <ConfirmScreen
        email={state.confirmEmail}
        onEditEmail={() => setEditingAfterConfirm(true)}
      />
    );
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Create your account
      </h1>
      <p className="text-sm text-muted mt-1">
        QR ordering, bill splitting and payments — live in a few minutes.
        Next you&apos;ll set up your venue: name, tables and menu.
      </p>

      <div className="mt-6">
        <GoogleSignInButton />
      </div>

      <div className="flex items-center gap-3 my-5">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-muted">or with email</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            defaultValue={editingAfterConfirm ? state.confirmEmail : undefined}
            required
          />
        </div>
        <PasswordField />

        {state.error && (
          <div>
            <FormMessage tone="error">{state.error}</FormMessage>
            {state.accountExists && (
              <p className="text-sm text-muted mt-2">
                <Link href="/login" className="text-pine font-medium hover:underline">
                  Log in
                </Link>{" "}
                or{" "}
                <Link
                  href="/forgot-password"
                  className="text-pine font-medium hover:underline"
                >
                  reset your password
                </Link>{" "}
                instead.
              </p>
            )}
          </div>
        )}

        <SubmitButton pendingLabel="Creating…">Create account</SubmitButton>
      </form>

      <p className="text-xs text-muted mt-4 text-center">
        By creating an account you agree to Tillz&apos;s{" "}
        <Link href="/terms" className="hover:text-ink underline underline-offset-2">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="hover:text-ink underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="text-sm text-muted mt-4 text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-pine font-medium hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}

// The one requirement actually enforced server-side (8+ characters) — shown
// live rather than only as an error after submit, and never claims a rule
// that isn't really checked.
function PasswordField() {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const longEnough = value.length >= 8;

  return (
    <div>
      <Label htmlFor="password">Password</Label>
      <div className="relative">
        <Input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="pr-16"
          required
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-ink"
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <p
        className={`text-xs mt-1.5 flex items-center gap-1.5 ${
          longEnough ? "text-pine-deep" : "text-muted"
        }`}
      >
        <span aria-hidden>{longEnough ? "✓" : "○"}</span>
        At least 8 characters
      </p>
    </div>
  );
}

function ConfirmScreen({
  email,
  onEditEmail,
}: {
  email: string;
  onEditEmail: () => void;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function resend() {
    setErr(null);
    setMsg(null);
    start(async () => {
      const res = await resendConfirmation(email);
      if (res.error) setErr(res.error);
      else {
        setMsg(res.info ?? "Sent.");
        setCooldown(RESEND_COOLDOWN_SECONDS);
        timerRef.current = setInterval(() => {
          setCooldown((c) => {
            if (c <= 1) {
              if (timerRef.current) clearInterval(timerRef.current);
              return 0;
            }
            return c - 1;
          });
        }, 1000);
      }
    });
  }

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
        disabled={pending || cooldown > 0}
        onClick={resend}
        className="mt-5 text-sm rounded-lg border border-line px-4 py-2 hover:border-ink/30 disabled:opacity-50"
      >
        {pending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
      </button>

      <p className="text-sm text-muted mt-4">
        <button onClick={onEditEmail} className="text-pine font-medium hover:underline">
          Wrong email? Edit it
        </button>
      </p>

      <p className="text-sm text-muted mt-2">
        <Link href="/login" className="text-pine font-medium hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
