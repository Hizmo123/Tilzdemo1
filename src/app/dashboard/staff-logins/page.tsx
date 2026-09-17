import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/urls";
import { qrDataUrlForUrl } from "@/lib/qr";
import { StaffLoginsManager } from "./staff-logins-manager";

export default async function StaffLoginsPage() {
  const authz = await getAuthz();

  if (!authz.membership) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Staff logins
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

  if (!authz.can("staff:manage")) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Staff logins
        </h1>
        <p className="text-muted">You don&apos;t have permission to manage staff.</p>
      </div>
    );
  }

  const restaurant = authz.membership.organization.restaurants[0];
  if (!restaurant) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Staff logins
        </h1>
        <p className="text-muted">Create your restaurant first.</p>
      </div>
    );
  }

  const staff = await prisma.staffAccount.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { createdAt: "asc" },
  });

  const base = appBaseUrl();
  const loginUrl = `${base}/staff/${restaurant.slug}`;
  const qrPreview = await qrDataUrlForUrl(loginUrl);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Staff logins
        </h1>
        <p className="text-muted mt-1">
          PIN logins for floor and kitchen staff. Managers who need full accounts
          go under{" "}
          <Link href="/dashboard/staff" className="text-pine hover:underline">
            Team
          </Link>
          .
        </p>
      </div>

      <StaffLoginsManager
        loginUrl={loginUrl}
        qrPreview={qrPreview}
        kitchenStations={restaurant.kitchenStations}
        staff={staff.map((s) => ({
          id: s.id,
          name: s.name,
          role: s.role,
          active: s.active,
          assignedStation: s.assignedStation,
          lastLoginAt: s.lastLoginAt ? s.lastLoginAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
