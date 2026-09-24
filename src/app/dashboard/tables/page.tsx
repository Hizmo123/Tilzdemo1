import Link from "next/link";
import { getActiveLocation } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isFullyStaffedMode } from "@/lib/onboarding-options";
import { PublicMenuLink } from "@/components/dashboard/public-menu-link";
import { CreateTableForm } from "./create-table-form";

export default async function TablesPage() {
  const ctx = await getActiveLocation();

  // No restaurant yet — send them back to onboarding.
  if (!ctx) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Tables
        </h1>
        <p className="text-muted">
          Create your restaurant first from the{" "}
          <Link href="/dashboard" className="text-pine hover:underline">
            Overview
          </Link>{" "}
          page.
        </p>
      </div>
    );
  }

  const { restaurant, location } = ctx;

  const tables = await prisma.table.findMany({
    where: { locationId: location.id },
    orderBy: [{ section: "asc" }, { createdAt: "asc" }],
  });

  // Fully staffed (staff take orders AND handle payment): a customer never
  // scans a table QR for THIS venue's own workflow — see
  // isFullyStaffedMode. useSharedQr is the owner's explicit choice (fresh
  // venues default to it automatically; existing ones choose in Settings ->
  // Service — see dashboard/settings/venue-setup/actions.ts) to lead with
  // the one shared QR instead of the per-table grid below. Nothing here
  // ever deletes a Table/QrToken row — existing codes just move to a
  // secondary section rather than the primary view.
  const fullyStaffed = isFullyStaffedMode(restaurant.customerOrdering, restaurant.customerPayment);
  const showSharedQr = fullyStaffed && restaurant.useSharedQr;

  // Group by section for display. Untitled section falls under "Tables".
  const groups = new Map<string, typeof tables>();
  for (const t of tables) {
    const key = t.section ?? "Tables";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  function tableGrid() {
    return (
      <div className="space-y-6">
        {[...groups.entries()].map(([section, rows]) => (
          <div key={section}>
            <h3 className="text-sm font-medium text-muted mb-3">{section}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {rows.map((t) => (
                <Link
                  key={t.id}
                  href={`/dashboard/tables/${t.id}`}
                  className="group rounded-[var(--radius-card)] border border-line bg-surface p-4 hover:border-pine/40 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-display text-xl font-semibold tracking-tight">
                      {t.label}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--radius-xs)] ${
                        t.active
                          ? "bg-pine-soft text-pine-deep"
                          : "bg-paper text-muted"
                      }`}
                    >
                      {t.active ? "Active" : "Off"}
                    </span>
                  </div>
                  <span className="text-xs text-pine mt-3 inline-block group-hover:underline">
                    View QR →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Tables
        </h1>
        <p className="text-muted mt-1">
          {restaurant.name} · {location.name}
        </p>
      </div>

      {showSharedQr ? (
        <>
          <div className="rounded-[var(--radius-card)] border border-line bg-paper p-4 text-sm text-ink-soft">
            Staff take orders and handle payment for this venue, so customers never scan a
            table QR — one shared code covers every table instead. Change this anytime in{" "}
            <Link href="/dashboard/settings/service" className="text-pine hover:underline">
              Settings → Service
            </Link>
            .
          </div>
          <PublicMenuLink slug={restaurant.slug} />
          {tables.length > 0 && (
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
                Existing table codes
              </h2>
              <p className="text-sm text-muted mb-3">
                From before this venue switched to a shared QR — still here if you&apos;re
                using the printed stands.
              </p>
              {tableGrid()}
            </div>
          )}
        </>
      ) : (
        <>
          {fullyStaffed ? (
            <div className="rounded-[var(--radius-card)] border border-line bg-paper p-4 text-sm text-ink-soft">
              Staff take orders and handle payment for this venue, so new tables here won&apos;t
              generate a QR customers would use. Change this in{" "}
              <Link href="/dashboard/settings/service" className="text-pine hover:underline">
                Settings → Service
              </Link>{" "}
              to switch to one shared QR instead.
            </div>
          ) : (
            <CreateTableForm />
          )}

          {tables.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center">
              <p className="text-muted">
                {fullyStaffed
                  ? "No tables yet."
                  : "No tables yet. Add your first one above to generate its QR code."}
              </p>
            </div>
          ) : (
            tableGrid()
          )}
        </>
      )}
    </div>
  );
}
