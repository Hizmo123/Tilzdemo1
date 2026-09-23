import Link from "next/link";
import { getAuthz } from "@/lib/auth";
import { MenuImportForm } from "./menu-import-form";

export default async function MenuImportPage() {
  const authz = await getAuthz();
  const restaurant = authz.membership?.organization.restaurants[0];

  if (!restaurant) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Import menu
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

  if (!authz.can("menu:manage")) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          Import menu
        </h1>
        <p className="text-muted">You don&apos;t have permission to edit the menu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <Link href="/dashboard/menu" className="text-sm text-muted hover:text-ink">
          ← Menu
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight mt-1">
          Import menu
        </h1>
        <p className="text-muted mt-1">
          Bring in your whole menu from a spreadsheet instead of typing it in
          one item at a time.
        </p>
      </div>

      <MenuImportForm currency={restaurant.currency} restaurantName={restaurant.name} />
    </div>
  );
}
