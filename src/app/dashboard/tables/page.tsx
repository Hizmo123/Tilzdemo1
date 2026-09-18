import Link from "next/link";
import { getActiveLocation } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const tables = await prisma.table.findMany({
    where: { locationId: ctx.location.id },
    orderBy: [{ section: "asc" }, { createdAt: "asc" }],
  });

  // Group by section for display. Untitled section falls under "Tables".
  const groups = new Map<string, typeof tables>();
  for (const t of tables) {
    const key = t.section ?? "Tables";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Tables
          </h1>
          <p className="text-muted mt-1">
            {ctx.restaurant.name} · {ctx.location.name}
          </p>
        </div>
        <Link
          href="/dashboard/tables/order-stands"
          className="shrink-0 text-sm rounded-lg border border-line bg-surface px-3.5 py-2 font-medium hover:border-ink/30 transition-colors"
        >
          Order physical stands
        </Link>
      </div>

      <CreateTableForm />

      {tables.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center">
          <p className="text-muted">
            No tables yet. Add your first one above to generate its QR code.
          </p>
        </div>
      ) : (
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
                        className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
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
      )}
    </div>
  );
}
