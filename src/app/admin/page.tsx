import { requirePlatformAdmin } from "@/lib/platform-admin";

// Real content lands in Task 6 (MRR, subscriptions, activation funnel, stand
// inventory). This is deliberately just the gate + a placeholder for now —
// Task 0 is scoped to proving the security boundary works before anything
// cross-tenant is built on top of it.
export default async function AdminHomePage() {
  await requirePlatformAdmin();

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Platform overview
      </h1>
      <p className="text-muted mt-1">Coming in a later task.</p>
    </div>
  );
}
