import Link from "next/link";
import { checkReactivationToken } from "@/lib/account";
import { ReactivateButton } from "./reactivate-button";

export const dynamic = "force-dynamic";

// Reached from the reactivation email a deactivated account's owner is sent
// (see lib/account.ts#deactivateAccount). No auth required — the token itself
// is the credential, same pattern as the invite/QR token flows. This page
// only READS the token's validity; the actual reactivation only happens on
// an explicit button click (see reactivate-button.tsx) — mutating straight
// off the GET would let a link-scanner or browser prefetch silently burn a
// one-time token before the owner ever saw the page.
export default async function ReactivatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const check = await checkReactivationToken(token);

  return (
    <main className="min-h-dvh bg-paper flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        {"error" in check ? (
          <>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Couldn&apos;t reactivate
            </h1>
            <p className="text-muted text-sm mt-2">{check.error}</p>
          </>
        ) : (
          <ReactivateButton token={token} organizationName={check.organizationName} />
        )}
        <Link href="/login" className="text-sm text-pine hover:underline mt-6 inline-block">
          Go to sign in
        </Link>
      </div>
    </main>
  );
}
