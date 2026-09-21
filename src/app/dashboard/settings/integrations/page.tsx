import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SquareCard } from "./square-card";

const ERROR_COPY: Record<string, string> = {
  state_mismatch: "That connection attempt expired or didn't match — please try again.",
  missing_params: "Square didn't return the expected response — please try again.",
  exchange_failed: "Couldn't complete the connection with Square — please try again.",
  access_denied: "Square connection was cancelled.",
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ square?: string; reason?: string }>;
}) {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0];

  if (!restaurant) {
    return <p className="text-muted">Create your restaurant first from the Overview page.</p>;
  }
  if (!authz.can("settings:manage")) {
    return <p className="text-muted">You don&apos;t have permission to change settings.</p>;
  }

  const sp = await searchParams;
  const connection = await prisma.squareConnection.findUnique({
    where: { restaurantId: restaurant.id },
    select: { merchantName: true, environment: true, locationId: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/settings" className="text-sm text-muted hover:text-ink">
          ← Settings
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight mt-1">
          Integrations
        </h1>
        <p className="text-muted mt-1">Connect this venue to point-of-sale providers.</p>
      </div>

      {sp.square === "success" && (
        <p className="text-sm rounded-lg bg-pine/10 text-pine-deep px-3.5 py-2.5">
          Square connected.
        </p>
      )}
      {sp.square === "error" && (
        <p className="text-sm rounded-lg bg-red-50 text-danger px-3.5 py-2.5">
          {ERROR_COPY[sp.reason ?? ""] ?? "Couldn't connect Square — please try again."}
        </p>
      )}

      <div className="max-w-lg">
        <SquareCard connection={connection} />
      </div>
    </div>
  );
}
