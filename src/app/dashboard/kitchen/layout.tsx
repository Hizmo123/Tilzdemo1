import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";

// Hard guard: on Connect, Square owns the kitchen — Tillz's own kitchen
// screen (device setup instructions + its QR) is a dead end, so a Connect
// org typing this URL directly must be bounced back, not just miss the nav
// link (see dashboard/layout.tsx's nav filtering, which is cosmetic only).
export default async function DashboardKitchenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { membership } = await getTenantContext();
  if (membership) {
    const ent = await getEntitlements(membership.organizationId);
    if (ent.requiresSquare) redirect("/dashboard");
  }
  return children;
}
