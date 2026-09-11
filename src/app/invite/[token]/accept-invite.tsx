"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "./actions";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div>
        <p className="text-pine-deep font-medium">You&apos;re in! 🎉</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-3 w-full rounded-lg bg-ink text-surface py-2.5 font-medium hover:opacity-90"
        >
          Go to dashboard
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await acceptInvite(token);
            if (res?.error) setError(res.error);
            else setDone(true);
          });
        }}
        className="w-full rounded-lg bg-pine text-white py-2.5 font-medium hover:bg-pine-deep disabled:opacity-60"
      >
        {pending ? "Joining…" : "Accept invite"}
      </button>
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
