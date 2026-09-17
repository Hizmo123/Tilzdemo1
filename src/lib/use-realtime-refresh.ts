"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { restaurantChannel } from "@/lib/realtime";

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

// Subscribes to a restaurant's realtime channel and fires `onChange`
// immediately when the server broadcasts a "changed" event — the instant a
// mutation happens, not on the next poll tick. Polling stays in place as the
// fallback (a dropped websocket, a missed broadcast) so nothing regresses if
// realtime hiccups; this only makes the common case faster.
//
// Also returns the channel's own connection state, so a caller that needs to
// show "you've lost the server" (the kitchen screen) can — and triggers an
// extra onChange the moment the channel comes back from a drop, in case
// something happened while it was down.
export function useRealtimeRefresh(
  restaurantId: string | null,
  onChange: () => void,
): { status: RealtimeStatus } {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const wasDown = useRef(false);

  useEffect(() => {
    if (!restaurantId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(restaurantChannel(restaurantId))
      .on("broadcast", { event: "changed" }, () => onChangeRef.current())
      .subscribe((subStatus) => {
        if (subStatus === "SUBSCRIBED") {
          setStatus("connected");
          // Coming back from a drop — refetch immediately rather than
          // waiting for the next poll or the next real change.
          if (wasDown.current) onChangeRef.current();
          wasDown.current = false;
        } else if (subStatus === "CHANNEL_ERROR" || subStatus === "TIMED_OUT" || subStatus === "CLOSED") {
          setStatus("disconnected");
          wasDown.current = true;
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  return { status };
}
