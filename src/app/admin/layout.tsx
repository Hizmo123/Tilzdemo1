import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platform-admin";

// Every /admin page renders through this layout, but the layout alone is
// NOT the security boundary — see src/lib/platform-admin.ts. Every
// individual /admin server action calls requirePlatformAdmin() again,
// independently, since a server action can be invoked directly without this
// layout ever rendering.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();

  return (
    <div className="min-h-dvh flex">
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-line bg-surface sticky top-0 h-dvh">
        <div className="px-5 py-5 border-b border-line">
          <span className="font-display text-lg font-semibold tracking-tight">
            Tillz admin
          </span>
          <p className="text-xs text-muted mt-0.5">Platform console</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <Link
            href="/admin"
            className="flex items-center rounded-lg px-3 py-2 text-sm text-ink hover:bg-paper transition-colors"
          >
            Overview
          </Link>
          <Link
            href="/admin/orgs"
            className="flex items-center rounded-lg px-3 py-2 text-sm text-ink hover:bg-paper transition-colors"
          >
            Organisations
          </Link>
          <Link
            href="/admin/fulfilment"
            className="flex items-center rounded-lg px-3 py-2 text-sm text-ink hover:bg-paper transition-colors"
          >
            Fulfilment
          </Link>
          <Link
            href="/admin/products"
            className="flex items-center rounded-lg px-3 py-2 text-sm text-ink hover:bg-paper transition-colors"
          >
            Products
          </Link>
        </nav>
        <div className="border-t border-line px-5 py-4">
          <Link href="/dashboard" className="text-xs text-muted hover:text-ink">
            ← Back to regular dashboard
          </Link>
        </div>
      </aside>
      <main className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
