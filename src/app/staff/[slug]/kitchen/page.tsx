import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireStaffForSlug } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import { getEntitlements } from "@/lib/entitlements";
import { KitchenHeader } from "./kitchen-header";
import { KitchenBoardData } from "./kitchen-board-data";

export const dynamic = "force-dynamic";

// Skeleton shown the instant the (fast, data-independent) header has
// rendered, while the ticket/approval/served queries are still in flight —
// see kitchen-board-data.tsx for why this is split out.
function BoardSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-6 space-y-3 animate-pulse">
      <div className="h-8 w-40 rounded-lg bg-line/60" />
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="h-32 rounded-[var(--radius-card)] bg-line/40" />
        <div className="h-32 rounded-[var(--radius-card)] bg-line/40" />
      </div>
    </div>
  );
}

export default async function KitchenPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ station?: string; view?: string }>;
}) {
  const { slug } = await params;
  const { station: stationFilter, view } = await searchParams;

  const session = await requireStaffForSlug(slug);
  if (!session) redirect(`/staff/${slug}`);

  const { staff, restaurant } = session;

  // LITE has no live ordering, so no kitchen tickets ever exist — rendered
  // inline rather than redirected: the PIN login page (staff/[slug]/page.tsx)
  // sends a KITCHEN-role, station-locked account straight HERE on sign-in,
  // so a redirect back to login would loop forever for that account.
  const ent = await getEntitlements(restaurant.organizationId);
  if (!ent.ordering) {
    return (
      <main className="min-h-dvh bg-paper flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            No kitchen screen on this plan
          </h1>
          <p className="text-sm text-muted mt-2">
            This venue&apos;s current plan doesn&apos;t include live ordering.
            Ask an owner to upgrade from the dashboard.
          </p>
        </div>
      </main>
    );
  }

  // A KITCHEN account assigned to one station (see StaffAccount.assignedStation)
  // is locked to it server-side — the URL's own ?station= is ignored rather
  // than trusted, and Pass (a deliberately cross-station expo view) is hidden
  // entirely, so this really is a per-station device, not just a bookmarked
  // filter someone could edit out of.
  const lockedStation = staff.role === "KITCHEN" ? staff.assignedStation : null;

  if (!roleCan(staff.role, "kitchen:manage")) {
    return (
      <main className="min-h-dvh bg-paper">
        <header className="border-b border-line bg-surface px-5 py-4 flex items-center gap-3">
          <Link href={`/staff/${slug}/home`} className="text-sm text-muted hover:text-ink">
            ← Tables
          </Link>
          <span className="font-display text-lg font-semibold tracking-tight">Kitchen</span>
        </header>
        <p className="max-w-3xl mx-auto px-5 py-6 text-sm text-muted">
          Your role doesn&apos;t include kitchen access.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-paper">
      <KitchenHeader slug={slug} staffName={staff.name} lockedStation={lockedStation} />
      <Suspense fallback={<BoardSkeleton />}>
        <KitchenBoardData
          slug={slug}
          restaurantId={restaurant.id}
          staffApproval={restaurant.staffApproval}
          paymentTiming={restaurant.paymentTiming}
          kitchenChime={restaurant.kitchenChime}
          lockedStation={lockedStation}
          stationFilter={stationFilter}
          view={view}
          definedStations={restaurant.kitchenStations}
          readOnly={ent.requiresSquare}
        />
      </Suspense>
    </main>
  );
}
