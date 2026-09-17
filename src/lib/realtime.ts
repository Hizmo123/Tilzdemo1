import { createServiceClient } from "@/lib/supabase/service";

// Push-based "something changed" signal, layered on top of (never replacing)
// the existing polling. Uses Supabase Realtime's Broadcast feature over HTTP —
// no websocket connection to hold open from a serverless function, just one
// request per notify. The payload carries no data, only a channel name keyed
// by restaurant id: any real data still comes from the normal Prisma-backed
// page load, so this can't leak anything by existing. If it fails for any
// reason (Realtime down, no service key), it's swallowed — a slightly-delayed
// poll-driven refresh is the fallback, never a broken mutation.
export async function notifyRestaurant(restaurantId: string): Promise<void> {
  try {
    const supabase = createServiceClient();
    const channel = supabase.channel(restaurantChannel(restaurantId));
    await channel.httpSend("changed", {});
    await supabase.removeChannel(channel);
  } catch {
    /* best-effort */
  }
}

export function restaurantChannel(restaurantId: string): string {
  return `restaurant-${restaurantId}`;
}
