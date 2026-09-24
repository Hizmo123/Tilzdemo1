"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateVenueSetup } from "./actions";
import type { ExperienceModeKey, SplitMethod } from "@/lib/onboarding-options";
import { VenueTypePicker } from "@/components/venue-setup/venue-type-picker";
import { ExperienceModePicker } from "@/components/venue-setup/experience-mode-picker";
import { SplitMethodsPicker } from "@/components/venue-setup/split-methods-picker";

type Initial = {
  venueType: string;
  experienceMode: string;
  customerOrdering: boolean;
  customerPayment: boolean;
  paymentTiming: "before" | "after";
  staffApproval: boolean;
  splitMethods: string[];
};

export function VenueSetupForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [venueType, setVenueType] = useState(initial.venueType);
  const [experienceMode, setExperienceMode] = useState<ExperienceModeKey>(
    initial.experienceMode as ExperienceModeKey,
  );
  const [settings, setSettings] = useState({
    customerOrdering: initial.customerOrdering,
    customerPayment: initial.customerPayment,
    paymentTiming: initial.paymentTiming,
    staffApproval: initial.staffApproval,
  });
  const [splitMethods, setSplitMethods] = useState<SplitMethod[]>(
    initial.splitMethods as SplitMethod[],
  );
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set only when the server holds the save pending a choice between the
  // venue's existing per-table QR codes and the one shared QR — see
  // updateVenueSetup's needsTableQrChoice.
  const [tableQrPrompt, setTableQrPrompt] = useState<number | null>(null);

  function save(tableQrChoice?: "shared" | "keep") {
    setError(null);
    setMsg(null);
    start(async () => {
      const res = await updateVenueSetup({
        venueType,
        experienceMode,
        ...settings,
        splitMethods,
        tableQrChoice,
      });
      if ("needsTableQrChoice" in res) {
        setTableQrPrompt(res.tableCount);
        return;
      }
      setTableQrPrompt(null);
      if (res.error) setError(res.error);
      else {
        setMsg("Saved.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Venue type</h2>
        <VenueTypePicker value={venueType} onChange={setVenueType} />
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          What should Tillz do for you?
        </h2>
        <ExperienceModePicker
          mode={experienceMode}
          settings={settings}
          onChange={(mode, next) => {
            setExperienceMode(mode);
            setSettings(next);
          }}
        />
      </section>

      {settings.customerPayment && (
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            How can guests split the bill?
          </h2>
          <SplitMethodsPicker value={splitMethods} onChange={setSplitMethods} />
        </section>
      )}

      {tableQrPrompt !== null && (
        <section className="rounded-[var(--radius-card)] border border-pine/30 bg-pine-soft/40 p-6 space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            You have {tableQrPrompt} existing table QR code{tableQrPrompt === 1 ? "" : "s"}
          </h2>
          <p className="text-sm text-muted">
            This mode doesn&apos;t need a QR code per table — customers never scan one for
            ordering or payment. Nothing is deleted either way; this only changes what your
            dashboard leads with.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => save("shared")}
              disabled={pending}
              className="rounded-lg bg-pine text-white px-4 py-2.5 text-sm font-medium hover:bg-pine-deep disabled:opacity-60"
            >
              Switch to one shared QR
            </button>
            <button
              onClick={() => save("keep")}
              disabled={pending}
              className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium hover:border-ink/30 disabled:opacity-60"
            >
              Keep my existing per-table codes
            </button>
          </div>
        </section>
      )}

      <div className="sticky bottom-4 flex items-center gap-3">
        <button
          onClick={() => save()}
          disabled={pending}
          className="rounded-xl bg-pine text-[color:var(--on-accent,#fff)] px-6 py-3 font-medium hover:bg-pine-deep disabled:opacity-60 shadow-sm"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
        {msg && <p className="text-sm text-pine-deep">{msg}</p>}
      </div>
    </div>
  );
}
