import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffForSlug, requireStaffOrdering } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import { getMenuForCustomer } from "@/lib/bills";
import { SoldOutList } from "./sold-out-list";

export const dynamic = "force-dynamic";

export default async function StaffMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await requireStaffForSlug(slug);
  if (!session) redirect(`/staff/${slug}`);
  // HARD guard: LITE has no live ordering to run any of this against — see
  // lib/staff-auth.ts#requireStaffOrdering for why this is NOT
  // lib/auth.ts#requireOrdering (owner Supabase session vs staff PIN session).
  await requireStaffOrdering(session.restaurant.organizationId, slug);

  const { staff, restaurant } = session;

  if (!roleCan(staff.role, "menu:availability")) {
    return (
      <main className="min-h-dvh bg-paper">
        <header className="border-b border-line bg-surface px-5 py-4 flex items-center gap-3">
          <Link href={`/staff/${slug}/home`} className="text-sm text-muted hover:text-ink">
            ← Tables
          </Link>
          <span className="font-display text-lg font-semibold tracking-tight">Menu</span>
        </header>
        <p className="max-w-2xl mx-auto px-5 py-6 text-sm text-muted">
          Your role can&apos;t change the menu.
        </p>
      </main>
    );
  }

  const menuRows = await getMenuForCustomer(restaurant.id);
  const categories = menuRows.map((c) => ({
    id: c.id,
    name: c.name,
    items: c.items.map((i) => ({
      id: i.id,
      name: i.name,
      priceCents: i.priceCents,
      available: i.available,
    })),
  }));

  return (
    <main className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-surface px-5 py-4 sticky top-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/staff/${slug}/home`} className="text-sm text-muted hover:text-ink">
            ← Tables
          </Link>
          <span className="font-display text-lg font-semibold tracking-tight">Menu</span>
        </div>
        <span className="text-xs text-muted">{staff.name}</span>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6">
        <p className="text-sm text-muted mb-4">
          Tap to mark an item sold out — it disappears from customer ordering
          straight away.
        </p>
        {categories.length === 0 ? (
          <p className="text-sm text-muted">No menu items yet.</p>
        ) : (
          <SoldOutList slug={slug} currency={restaurant.currency} categories={categories} />
        )}
      </div>
    </main>
  );
}
