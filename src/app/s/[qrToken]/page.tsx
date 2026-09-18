import { redirect } from "next/navigation";
import { resolveStand } from "@/lib/stands";

export const dynamic = "force-dynamic";

// Where every printed Tillz stand's QR points. Public, no auth — same trust
// level as /v/[token] itself. Rate-limited in src/middleware.ts.
//
// This is deliberately a thin resolve-and-redirect, never an ordering screen
// of its own: the actual menu/cart/bill flow only ever lives at /v/[token].
// A stand that isn't activated yet (UNCLAIMED, or its table's own QR token
// got revoked) shows a plain "not set up" message — NEVER anything that
// looks like it could take an order.
export default async function StandPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  const result = await resolveStand(qrToken);

  if (result.ok) {
    redirect(result.redirectTo);
  }

  if (result.reason === "not_setup") {
    return (
      <main className="min-h-dvh bg-paper flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            This Tillz stand isn&apos;t set up yet
          </h1>
          <p className="text-sm text-muted mt-2">
            Please ask a staff member for help.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-paper flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Code not recognised
        </h1>
        <p className="text-sm text-muted mt-2">
          This code isn&apos;t valid. Please ask a staff member for help.
        </p>
      </div>
    </main>
  );
}
