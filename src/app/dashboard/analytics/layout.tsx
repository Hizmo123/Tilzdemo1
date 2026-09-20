import { requireOrdering } from "@/lib/auth";

// Hard guard, covering every analytics subroute (customers/orders/products/
// weekly) in one place — see dashboard/tables/layout.tsx for why this can't
// be nav-only.
export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOrdering();
  return children;
}
