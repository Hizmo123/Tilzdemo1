import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MfaForm } from "./mfa-form";

export const dynamic = "force-dynamic";

export default async function MfaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // If this account doesn't actually need a second factor, don't trap them here.
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!(aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2")) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-dvh bg-paper flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Two-factor check
          </h1>
          <p className="text-muted text-sm mt-1">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
          <MfaForm />
        </div>
      </div>
    </main>
  );
}
