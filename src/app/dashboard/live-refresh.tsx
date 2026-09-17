"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";

// Re-fetches the current server-rendered page so new orders, bills and
// payments appear without a manual refresh.
//
//  - Instant: subscribed to the restaurant's realtime channel (see
//    @/lib/realtime) — a mutation anywhere broadcasts immediately, so this
//    refreshes the moment something actually changes instead of waiting for
//    the next tick.
//  - Polling stays on as a fallback for a missed/dropped broadcast, with two
//    guards that keep it from getting in the user's way:
//     - It skips while the tab is hidden (no point refreshing an unseen page,
//       and it saves the phone's battery/data).
//     - It pauses for a few seconds after any tap/click. A router.refresh()
//       that fires the instant you tap a <Link> aborts the pending navigation
//       — which on mobile shows up as "I tapped the table and nothing
//       happened". Pausing around interactions lets taps land.
export function LiveRefresh({
  seconds = 20,
  restaurantId = null,
}: {
  seconds?: number;
  restaurantId?: string | null;
}) {
  const router = useRouter();

  useRealtimeRefresh(restaurantId, () => router.refresh());

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
