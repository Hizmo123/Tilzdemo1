"use client";

import { useEffect, useState } from "react";

// Keeps the screen awake for as long as the calling component is mounted —
// a kitchen tablet left on the pass otherwise sleeps mid-service. The lock is
// automatically dropped by the browser whenever the tab is backgrounded, so
// this re-acquires on visibility change (coming back from another app,
// waking the tablet from sleep, etc). Falls back gracefully — `supported`
// tells the caller whether to show a "turn off screen sleep manually" hint.
export function useWakeLock(enabled: boolean) {
  const [supported] = useState(
    () => typeof navigator !== "undefined" && "wakeLock" in navigator,
  );
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled || !supported) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release();
          return;
        }
        setActive(true);
        sentinel.addEventListener("release", () => setActive(false));
      } catch {
        setActive(false);
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && !sentinel) acquire();
    }

    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      sentinel?.release().catch(() => {});
    };
  }, [enabled, supported]);

  return { supported, active };
}
