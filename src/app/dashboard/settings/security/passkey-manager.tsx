"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Passkey = { id: string; friendly_name?: string | null; created_at?: string };

// Biometric / passkey login (Face ID, Touch ID, Windows Hello, security key).
// Beta feature — passkeys are ADDITIVE: the password login always still works,
// so this can't lock anyone out.
export function PasskeyManager() {
  // Passkey methods are a beta addition; cast keeps types happy across versions.
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const auth = supabase.auth as any;

  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    try {
      const { data } = await auth.passkey.list();
      setPasskeys((data ?? []) as Passkey[]);
    } catch {
      // list may fail if passkeys aren't enabled on the project yet — that's ok.
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add() {
    setError(null);
    setMsg(null);
    setBusy(true);
    try {
      const { error } = await auth.registerPasskey();
      if (error) setError(error.message);
      else {
        setMsg("Passkey added. You can now sign in with your fingerprint or face.");
        refresh();
      }
    } catch {
      setError(
        "Couldn't add a passkey. Make sure passkeys are enabled for this project and your device supports biometrics.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await auth.passkey.delete({ passkeyId: id });
      refresh();
    } catch {
      setError("Couldn't remove that passkey.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 max-w-lg">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        Fingerprint & Face ID (passkeys)
      </h2>
      <p className="text-sm text-muted mt-1 mb-4">
        Sign in with your device&apos;s fingerprint or face instead of typing a
        password. Your password still works as a backup.
      </p>

      {passkeys.length > 0 && (
        <ul className="space-y-2 mb-4">
          {passkeys.map((pk) => (
            <li key={pk.id} className="flex items-center justify-between">
              <span className="text-sm">
                {pk.friendly_name || "Passkey"}
              </span>
              <button
                disabled={busy}
                onClick={() => remove(pk.id)}
                className="text-sm text-muted hover:text-danger disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {msg && <p className="text-sm text-pine-deep mb-3">{msg}</p>}
      {error && <p className="text-sm text-danger mb-3">{error}</p>}

      <button
        disabled={busy}
        onClick={add}
        className="rounded-[var(--radius-sm)] bg-pine text-white px-4 py-2 text-sm font-medium hover:bg-pine-deep disabled:opacity-50"
      >
        {busy ? "Setting up…" : "Add a passkey"}
      </button>
    </div>
  );
}
