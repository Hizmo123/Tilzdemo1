import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { requireStaffForSlug, requireStaffOrdering } from "@/lib/staff-auth";
import { roleCan } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getZReport } from "@/lib/cash-drawer";
import { ZReportView } from "@/components/register/z-report-view";
import { PrintButton } from "@/components/receipt/print-button";

export const dynamic = "force-dynamic";

export default async function SessionReportPage({
  params,
}: {
  params: Promise<{ slug: string; sessionId: string }>;
}) {
  const { slug, sessionId } = await params;

  const session = await requireStaffForSlug(slug);
  if (!session) redirect(`/staff/${slug}`);
  // HARD guard: LITE has no live ordering to run any of this against — see
  // lib/staff-auth.ts#requireStaffOrdering for why this is NOT
  // lib/auth.ts#requireOrdering (owner Supabase session vs staff PIN session).
  await requireStaffOrdering(session.restaurant.organizationId, slug);

  const { staff, restaurant } = session;

  if (!roleCan(staff.role, "payments:refund")) {
    return (
      <main className="min-h-dvh bg-paper">
        <header className="border-b border-line bg-surface px-5 py-4 flex items-center gap-3">
          <Link href={`/staff/${slug}/register`} className="text-sm text-muted hover:text-ink">
            ← Register
          </Link>
        </header>
        <p className="max-w-2xl mx-auto px-5 py-6 text-sm text-muted">
          Your role can&apos;t view drawer history.
        </p>
      </main>
    );
  }

  const [report, drawerSession] = await Promise.all([
    getZReport(sessionId, restaurant.id),
    prisma.cashDrawerSession.findFirst({
      where: { id: sessionId, restaurantId: restaurant.id },
      include: { location: { select: { name: true } } },
    }),
  ]);
  if (!report || !drawerSession) notFound();

  return (
    <main className="min-h-dvh bg-paper px-5 py-8 print:bg-white print:p-0">
      <div className="max-w-md mx-auto">
        <Link
          href={`/staff/${slug}/register/history`}
          className="print:hidden text-sm text-muted hover:text-ink mb-4 inline-block"
        >
          ← History
        </Link>
        <ZReportView
          report={report}
          restaurantName={restaurant.name}
          locationName={drawerSession.location.name}
          currency={restaurant.currency}
        />
        <div className="mt-4 flex justify-center print:hidden">
          <PrintButton />
        </div>
      </div>
    </main>
  );
}
