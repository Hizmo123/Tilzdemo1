import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { canCreateVenue } from "@/lib/entitlements";
import { signOut } from "@/app/(auth)/actions";
import { VenueCard } from "./venue-card";

export const dynamic = "force-dynamic";

export default async function VenuesPage() {
  const { membership } = await getTenantContext();
  if (!membership) redirect("/onboarding");

  const restaurants = membership.organization.restaurants;

  // Deliberately NOT skipped for a single-venue org: resolvePostLoginPath
  // (lib/auth.ts) is what auto-skips straight to /dashboard right after
  // sign-in when there's only one venue — that's a post-login routing
  // shortcut, not a reason this page itself should refuse to render. A
  // single-venue PRO org needs to be able to reach THIS page to find
  // "+ Add venue" below; redirecting it away entirely (as an earlier
  // version of this page did) would make that button unreachable.
  const canAdd = await canCreateVenue(membership.organizationId);

  return (
    <main className="min-h-dvh bg-paper px-5 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              Choose a venue
            </h1>
            <p className="text-muted mt-1">{membership.organization.name}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-ink-soft hover:text-danger transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {restaurants.map((r) => (
            <VenueCard key={r.id} id={r.id} name={r.name} published={r.published} />
          ))}
          <Link
            href="/venues/new"
            className="flex flex-col items-center justify-center gap-1.5 rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-5 text-muted hover:border-pine/40 hover:text-ink transition-colors min-h-[76px]"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-sm font-medium">Add venue</span>
          </Link>
        </div>
        {!canAdd.allowed && (
          <p className="text-xs text-muted mt-3">
            Adding another venue needs Pro —{" "}
            <Link href="/dashboard/billing" className="text-pine hover:underline">
              see plans
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
