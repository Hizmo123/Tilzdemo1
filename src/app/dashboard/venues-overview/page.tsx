import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthz } from "@/lib/auth";
import { getEntitlements } from "@/lib/entitlements";
import { getVenuesOverview } from "@/lib/venues-overview";
import { formatCents } from "@/lib/money";
import { RangeComparison } from "./range-comparison";
import { buttonClasses } from "@/components/ui/button-classes";

const SQUARE_HEALTH_LABEL: Record<string, { label: string; className: string }> = {
  connected: { label: "Square connected", className: "bg-pine-soft text-pine-deep" },
  needs_location: { label: "Needs a Square location", className: "bg-warn-soft text-warn" },
  revoked: { label: "Square disconnected", className: "bg-danger-soft text-danger" },
  not_connected: { label: "Not connected", className: "bg-paper text-muted" },
};

export default async function VenuesOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const authz = await getAuthz();
  if (!authz.membership) redirect("/dashboard");
  if (!authz.can("bills:view")) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">Venues</h1>
        <p className="text-muted">You don&apos;t have permission to view this.</p>
      </div>
    );
  }

  // Hard guard, same pattern as requireOrdering()/requireStaffOrdering() in
  // lib/auth.ts: a Lite/Basic/Growth org (or a base-Connect org without
  // this addon at all — crossVenueList is false unless the tier's own
  // venue capacity allows more than one) typing this URL directly must be
  // bounced back, not just kept from seeing the nav link (see
  // dashboard/layout.tsx's nav filtering, which is cosmetic only).
  const ent = await getEntitlements(authz.membership.organizationId);
  if (!ent.crossVenueList) redirect("/dashboard");

  const venues = await getVenuesOverview(authz.membership.organizationId);
  const showSquareColumn = venues.some((v) => v.squareHealth !== "not_connected");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Venues</h1>
        <p className="text-muted mt-1">
          Every venue in your organisation, at a glance ({venues.length}).
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-line bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line">
                <th className="px-5 py-3 font-medium">Venue</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium text-right">Today&apos;s sales</th>
                {showSquareColumn && <th className="px-5 py-3 font-medium">Square</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {venues.map((v) => {
                const health = v.squareHealth ? SQUARE_HEALTH_LABEL[v.squareHealth] : null;
                return (
                  <tr key={v.id}>
                    <td className="px-5 py-3 font-medium">{v.name}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`text-xs rounded-pill px-2.5 py-1 font-medium ${
                          v.published ? "bg-pine-soft text-pine-deep" : "bg-paper text-muted"
                        }`}
                      >
                        {v.published ? "Live" : "Offline"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-medium">
                      {formatCents(v.todaySalesCents, v.currency)}
                    </td>
                    {showSquareColumn && (
                      <td className="px-5 py-3">
                        {health && v.squareHealth !== "not_connected" && (
                          <span className={`text-xs rounded-pill px-2.5 py-1 font-medium ${health.className}`}>
                            {health.label}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {ent.crossVenueDashboard ? (
        <RangeComparison
          organizationId={authz.membership.organizationId}
          // Venues can each carry their own timezone; the range picker
          // needs ONE reference to resolve "Today"/"This month" against, so
          // this uses the org's first venue — same primary-venue assumption
          // the rest of the dashboard already makes in multi-location spots
          // (e.g. auth.ts's getActiveLocation).
          timezone={authz.membership.organization.restaurants[0]?.timezone ?? "Australia/Sydney"}
          searchParams={await searchParams}
        />
      ) : (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-6 text-center">
          <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
            Compare revenue across venues
          </h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            {ent.tier === "CONNECT"
              ? "Trends and side-by-side comparisons across every venue are part of Connect Plus."
              : "Trends and side-by-side comparisons across every venue are included on Pro."}
          </p>
          <Link
            href="/dashboard/billing"
            className={buttonClasses("primary", "sm", false, "mt-4")}
          >
            {ent.tier === "CONNECT" ? "Add Connect Plus" : "See plans"}
          </Link>
        </div>
      )}
    </div>
  );
}
