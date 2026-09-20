import { requireOrdering } from "@/lib/auth";

// Hard guard: LITE has no tables at all (menu-only) — a Lite org typing this
// URL directly must be bounced back to /dashboard, not just miss the nav
// link (see dashboard/layout.tsx's nav filtering, which is cosmetic only).
export default async function TablesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOrdering();
  return children;
}
