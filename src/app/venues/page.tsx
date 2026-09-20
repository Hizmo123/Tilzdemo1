import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/auth";
import { signOut } from "@/app/(auth)/actions";
import { VenueCard } from "./venue-card";

export const dynamic = "force-dynamic";

export default async function VenuesPage() {
  const { membership } = await getTenantContext();
  if (!membership) redirect("/onboarding");

  const restaurants = membership.organization.restaurants;

  // Nothing to pick between — go straight to the dashboard rather than
  // showing a picker with one option (same rule resolvePostLoginPath uses
  // right after sign-in; this covers reaching /venues directly by URL too).
  if (restaurants.length <= 1) redirect("/dashboard");

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
        </div>
      </div>
    </main>
  );
}
