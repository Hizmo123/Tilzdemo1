"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function MfaForm() {
  const supabase = createClient();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify() {
    setError(null);
    setBusy(true);
    const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
    if (fErr || !factors?.totp?.length) {
      setBusy(false);
      setError("No authenticator set up on this account.");
      return;
    }
    const factorId = factors.totp[0].id;
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
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <input
        inputMode="numeric"
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onKeyDown={(e) => e.key === "Enter" && code.length === 6 && verify()}
        placeholder="123456"
        className="w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-center text-2xl tracking-[0.3em] focus:border-pine focus:outline-none"
      />
      {error && <p className="text-sm text-danger mt-3">{error}</p>}
      <button
        disabled={busy || code.length < 6}
        onClick={verify}
        className="mt-4 w-full rounded-xl bg-pine text-white py-3 font-medium hover:bg-pine-deep disabled:opacity-50"
      >
        {busy ? "Verifying…" : "Verify"}
      </button>
    </div>
  );
}
