"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  sendOwnerVerification,
  verifyOwnerVerification,
} from "./actions";

// SMS verification of the owner's mobile. Sends a one-time code and confirms it.
// In dev (no Twilio configured) the code comes back as `devCode` so it's
// testable without a real gateway.
export function OwnerVerify({ initialPhone }: { initialPhone: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"idle" | "sent">("idle");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  if (initialPhone && !changing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-pine-deep font-medium">✓ Verified</span>{" "}
          <span className="text-muted">— {initialPhone}</span>
        </p>
        <button
          onClick={() => {
            setChanging(true);
            setStage("idle");
            setPhone("");
          }}
          className="text-sm text-muted hover:text-ink"
        >
          Change
        </button>
      </div>
    );
  }

  function send() {
    setError(null);
    setDevCode(null);
    start(async () => {
      const res = await sendOwnerVerification(phone);
      if ("error" in res) {
        setError(res.error);
      } else {
        setStage("sent");
        setDevCode(res.devCode ?? null);
      }
    });
  }

  function verify() {
    setError(null);
    start(async () => {
      const res = await verifyOwnerVerification(phone, code);
      if ("error" in res) setError(res.error);
      else {
        setChanging(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="04xx xxx xxx"
          disabled={stage === "sent"}
          className="flex-1 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-pine focus:outline-none disabled:bg-paper"
        />
        <button
          disabled={pending || phone.trim().length < 6}
          onClick={send}
          className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:border-ink/30 disabled:opacity-50"
        >
          {pending && stage === "idle" ? "…" : stage === "sent" ? "Resend" : "Send code"}
        </button>
      </div>

      {stage === "sent" && (
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className="flex-1 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-pine focus:outline-none"
          />
          <button
            disabled={pending || code.trim().length < 4}
            onClick={verify}
            className="rounded-lg bg-pine text-[color:var(--on-accent,#fff)] px-4 py-2.5 text-sm font-medium hover:bg-pine-deep disabled:opacity-50"
          >
            {pending ? "…" : "Verify"}
          </button>
        </div>
      )}

      {devCode && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2">
          Dev mode (no SMS gateway configured): your code is{" "}
          <span className="font-semibold tabular-nums">{devCode}</span>. Add
          Twilio credentials to send real texts.
        </p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
