import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { SecurityManager } from "./security-manager";
import { PasskeyManager } from "./passkey-manager";

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/settings" className="text-sm text-muted hover:text-ink">
          ← Settings
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight mt-1">
          Security
        </h1>
        <p className="text-muted mt-1">
          Extra protection for your account ({user.email}).
        </p>
      </div>
      {sp.required === "admin" && (
        <p className="rounded-[var(--radius-sm)] bg-warn-soft text-warn text-sm px-3.5 py-2.5">
          Platform admins must enable two-factor authentication before /admin is reachable.
          Enrol below, then sign back in.
        </p>
      )}
      <PasskeyManager />
      <SecurityManager />
    </div>
  );
}
