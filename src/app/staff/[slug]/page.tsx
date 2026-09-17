import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/staff-auth";
import { StaffLoginForm } from "./staff-login-form";

export const dynamic = "force-dynamic";

export default async function StaffLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Already signed in on this device → go straight to the staff home, or —
  // for a station-locked kitchen device — straight to its own board.
  const session = await getStaffSession();
  if (session && session.restaurant.slug === slug) {
    if (session.staff.role === "KITCHEN" && session.staff.assignedStation) {
      redirect(`/staff/${slug}/kitchen?station=${encodeURIComponent(session.staff.assignedStation)}`);
    }
    redirect(`/staff/${slug}/home`);
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: {
      staffAccounts: {
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
    },
  });

  if (!restaurant) {
    return (
      <main className="min-h-dvh bg-paper flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Venue not found
          </h1>
          <p className="text-sm text-muted mt-2">
            Check the staff login link with your manager.
          </p>
          <Link
            href="/staff"
            className="text-sm text-pine hover:underline mt-4 inline-block"
          >
            ← Try another venue
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-paper flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <Link href="/staff" className="text-sm text-muted hover:text-ink inline-block mb-4">
          ← Not your venue?
        </Link>
        <div className="text-center mb-6">
          <p className="text-sm font-medium text-pine">Staff sign in</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight mt-0.5">
            {restaurant.name}
          </h1>
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <StaffLoginForm slug={slug} staff={restaurant.staffAccounts} />
        </div>
      </div>
    </main>
  );
}
