"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateVenueSetup } from "./actions";
import type { ExperienceModeKey, SplitMethod } from "@/lib/onboarding-options";
import { VenueTypePicker } from "@/components/venue-setup/venue-type-picker";
import { ExperienceModePicker } from "@/components/venue-setup/experience-mode-picker";
import { SplitMethodsPicker } from "@/components/venue-setup/split-methods-picker";
import { PosPicker } from "@/components/venue-setup/pos-picker";

type Initial = {
  venueType: string;
  experienceMode: string;
  customerOrdering: boolean;
  customerPayment: boolean;
  paymentTiming: "before" | "after";
  staffApproval: boolean;
  splitMethods: string[];
  posProvider: string | null;
  posProviderOther: string;
  squareConnectInterest: boolean;
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
  const [posProvider, setPosProvider] = useState<"square" | "none" | null>(
    initial.posProvider === "square" ? "square" : initial.posProvider === "none" ? "none" : null,
  );
  const [posProviderOther, setPosProviderOther] = useState(initial.posProviderOther);
  const [squareConnectInterest, setSquareConnectInterest] = useState(
    initial.squareConnectInterest,
  );
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setMsg(null);
    start(async () => {
      const res = await updateVenueSetup({
        venueType,
        experienceMode,
        ...settings,
        splitMethods,
        posProvider,
        posProviderOther,
        squareConnectInterest,
      });
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

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Do you use Square?
        </h2>
        <PosPicker
          usesSquare={
            posProvider === "square" ? true : posProvider === "none" ? false : null
          }
          wantsConnect={squareConnectInterest}
          onUsesSquareChange={(usesSquare) => {
            setPosProvider(usesSquare ? "square" : "none");
            if (!usesSquare) setSquareConnectInterest(false);
          }}
          onWantsConnectChange={setSquareConnectInterest}
        />
      </section>

      <div className="sticky bottom-4 flex items-center gap-3">
        <button
          onClick={save}
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
