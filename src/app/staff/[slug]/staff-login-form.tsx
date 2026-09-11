"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitStaffLogin } from "./login-actions";

type StaffOption = { id: string; name: string };

export function StaffLoginForm({
  slug,
  staff,
}: {
  slug: string;
  staff: StaffOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const active = staff.find((s) => s.id === selected);

  function submit() {
    if (!selected) return;
    setError(null);
    start(async () => {
      const res = await submitStaffLogin(slug, selected, pin);
      if (res.error) {
        setError(res.error);
        setPin("");
      } else {
        router.push(`/staff/${slug}/home`);
      }
    });
  }

  // Step 1: pick your name.
  if (!active) {
    return (
      <div>
        <p className="text-sm text-muted mb-3 text-center">Tap your name</p>
        {staff.length === 0 ? (
          <p className="text-sm text-muted text-center">
            No staff set up yet. Ask your manager.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {staff.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className="rounded-xl border border-line bg-surface py-3 font-medium hover:border-pine/50 transition-colors"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Step 2: enter PIN.
  return (
    <div className="text-center">
      <p className="text-sm text-muted">Signing in as</p>
      <p className="font-display text-xl font-semibold tracking-tight mb-4">
        {active.name}
      </p>

      <input
        type="password"
        inputMode="numeric"
        autoFocus
        value={pin}
        onChange={(e) => {
          setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="• • • • •"
        className="w-full text-center text-2xl tracking-[0.4em] rounded-xl border border-line bg-surface py-3 focus:border-pine focus:outline-none"
      />

      {error && <p className="text-sm text-danger mt-3">{error}</p>}

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => {
            setSelected(null);
            setPin("");
            setError(null);
          }}
          className="rounded-xl border border-line px-4 py-3 font-medium hover:border-ink/30"
        >
          Back
        </button>
        <button
          onClick={submit}
          disabled={pending || pin.length < 4}
          className="flex-1 rounded-xl bg-pine text-white py-3 font-medium hover:bg-pine-deep disabled:opacity-50 transition-colors"
        >
          {pending ? "Checking…" : "Sign in"}
        </button>
      </div>
    </div>
  );
}
