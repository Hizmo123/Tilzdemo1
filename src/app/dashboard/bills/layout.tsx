import { requireOrdering } from "@/lib/auth";

// Hard guard: see dashboard/tables/layout.tsx for why this can't be nav-only.
export default async function BillsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOrdering();
  return children;
}
