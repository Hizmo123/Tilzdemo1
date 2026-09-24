"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; status: string };

export function SecurityManager() {
  const supabase = createClient();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);

  // Enrollment state
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data } = await supabase.auth.mfa.listFactors();
    const totp = data?.totp ?? [];
    setFactors(totp);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEnroll() {
    setError(null);
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setEnrolling(true);
  }

  async function confirmEnroll() {
    if (!factorId) return;
    setError(null);
    setBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr) {
      setBusy(false);
      setError(chErr.message);
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: ch.id,
      code: code.trim(),
    });
    setBusy(false);
    if (vErr) {
      setError("That code didn't match. Try the current one from your app.");
      return;
    }
    setEnrolling(false);
    setQr(null);
    setSecret(null);
    setCode("");
    setFactorId(null);
    refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    await supabase.auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    refresh();
  }

  const verified = factors.filter((f) => f.status === "verified");

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 max-w-lg">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        Two-factor authentication
      </h2>
      <p className="text-sm text-muted mt-1 mb-4">
        Add a code from an authenticator app (Google Authenticator, Authy, 1Password)
        on top of your password.
      </p>

      {verified.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-pine-soft text-pine-deep px-3.5 py-2.5 text-sm">
            <span>✓ Two-factor is on for your account.</span>
          </div>
          {verified.map((f) => (
            <div key={f.id} className="flex items-center justify-between">
              <span className="text-sm text-muted">Authenticator app</span>
              <button
                disabled={busy}
                onClick={() => remove(f.id)}
                className="text-sm text-muted hover:text-danger disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : enrolling ? (
        <div className="space-y-4">
          <p className="text-sm">
            1. Scan this with your authenticator app:
          </p>
          {qr && (
            // Supabase returns the QR as an SVG data URL.
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={qr} alt="Two-factor QR code" className="w-44 h-44" />
          )}
          {secret && (
            <p className="text-xs text-muted break-all">
              Or enter this key manually: <span className="font-mono">{secret}</span>
            </p>
          )}
          <p className="text-sm">2. Enter the 6-digit code it shows:</p>
          <input
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="w-40 rounded-[var(--radius-md)] border border-line bg-surface px-3.5 py-2.5 text-center text-lg tracking-[0.3em] focus:border-pine focus:outline-none"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={busy || code.length < 6}
              onClick={confirmEnroll}
              className="rounded-[var(--radius-sm)] bg-pine text-white px-4 py-2 text-sm font-medium hover:bg-pine-deep disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Turn on 2FA"}
            </button>
            <button
              onClick={() => {
                setEnrolling(false);
                setError(null);
              }}
              className="rounded-[var(--radius-sm)] border border-line px-4 py-2 text-sm hover:border-ink/30"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          {error && <p className="text-sm text-danger mb-3">{error}</p>}
          <button
            disabled={busy}
            onClick={startEnroll}
            className="rounded-[var(--radius-sm)] bg-pine text-white px-4 py-2 text-sm font-medium hover:bg-pine-deep disabled:opacity-50"
          >
            {busy ? "Starting…" : "Set up two-factor"}
          </button>
        </div>
      )}
    </div>
  );
}
