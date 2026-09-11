"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetches the current server-rendered page on an interval so payments and
// new bills appear without a manual refresh. A pragmatic stand-in for true
// push realtime (Supabase channels), which can replace this later without
// touching the pages that use it.
//
// Two guards keep the refresh from getting in the user's way:
//  - It skips while the tab is hidden (no point refreshing an unseen page, and
//    it saves the phone's battery/data).
//  - It pauses for a few seconds after any tap/click. A router.refresh() that
//    fires the instant you tap a <Link> aborts the pending navigation — which
//    on mobile shows up as "I tapped the table and nothing happened". Pausing
//    around interactions lets taps land.
export function LiveRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    let pausedUntil = 0;
    const bump = () => {
      pausedUntil = Date.now() + 4000;
    };

    // Capture phase so we register the interaction before navigation starts.
    document.addEventListener("pointerdown", bump, true);
    document.addEventListener("click", bump, true);

    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() < pausedUntil) return;
      router.refresh();
    }, seconds * 1000);

    return () => {
      clearInterval(id);
      document.removeEventListener("pointerdown", bump, true);
      document.removeEventListener("click", bump, true);
    };
  }, [router, seconds]);

  return null;
}
