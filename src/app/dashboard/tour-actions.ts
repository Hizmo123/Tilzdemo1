"use server";

import { getActiveLocation } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Records that the signed-in user's active venue has had its guided tour
// completed or skipped, so it never auto-starts again for that venue. Idem-
// potent; "Replay tour" deliberately never clears it. The reason is only
// for the log — both outcomes mean "don't nag".
export async function markDashboardTourComplete(reason: "skip" | "complete"): Promise<void> {
  const ctx = await getActiveLocation();
  if (!ctx) return;
  await prisma.restaurant.updateMany({
    where: { id: ctx.restaurant.id, dashboardTourCompletedAt: null },
    data: { dashboardTourCompletedAt: new Date() },
  });
  void reason;
}
