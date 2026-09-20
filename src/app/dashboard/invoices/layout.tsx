import { requireOrdering } from "@/lib/auth";

// Not explicitly named in the task's list (dashboard/tables, orders, bills,
// analytics), but Invoices only ever exist because bills do — same
// live-service data, same "must not reach by typing the URL" requirement,
// so it gets the same guard for the goal to actually hold. See
// dashboard/tables/layout.tsx for why this can't be nav-only.
export default async function InvoicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOrdering();
  return children;
}
