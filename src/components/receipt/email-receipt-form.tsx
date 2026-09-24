"use client";

import { useState, useTransition } from "react";

// Shared "email me a copy" form for both the customer and owner receipt
// pages — each passes its own bound server action, already scoped to the
// right bill via its own authorization (token or org membership).
export function EmailReceiptForm({
  action,
  initialEmail,
  sentAt,
}: {
  action: (email: string) => Promise<{ ok?: true } | { error?: string }>;
  initialEmail?: string | null;
  sentAt?: string | null;
}) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(!!sentAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send() {
    setError(null);
    start(async () => {
      const res = await action(email.trim());
      if (res && "error" in res && res.error) setError(res.error);
      else setSent(true);
    });
  }

  if (!open && !sent) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="print:hidden text-sm rounded-[var(--radius-sm)] border border-line px-3.5 py-2 hover:border-ink/30 transition-colors"
      >
        Email me a copy
      </button>
    );
  }

  if (sent && !open) {
    return (
      <p className="print:hidden text-sm text-pine-deep">
        ✓ Sent to {email || "your email"}.{" "}
        <button onClick={() => setOpen(true)} className="underline hover:no-underline">
          Send elsewhere
        </button>
      </p>
    );
  }

  return (
    <div className="print:hidden w-full max-w-xs">
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 rounded-[var(--radius-md)] border border-line bg-surface px-3 py-2 text-sm focus:border-pine focus:outline-none"
        />
        <button
          onClick={send}
          disabled={pending || !email.trim()}
          className="rounded-[var(--radius-sm)] bg-ink text-surface px-3.5 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
      {error && <p className="text-xs text-danger mt-1.5">{error}</p>}
    </div>
  );
}
