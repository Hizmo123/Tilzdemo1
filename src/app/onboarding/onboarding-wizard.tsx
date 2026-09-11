"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding, type OnboardingAnswers } from "./actions";
import { THEME_PRESETS, type ThemeKey } from "@/lib/theme";

const VENUE_TYPES: { value: string; label: string }[] = [
  { value: "cafe", label: "Café" },
  { value: "restaurant", label: "Restaurant" },
  { value: "bar", label: "Bar / pub" },
  { value: "bakery", label: "Bakery" },
  { value: "food_truck", label: "Food truck" },
  { value: "other", label: "Something else" },
];

const THEME_KEYS = Object.keys(THEME_PRESETS) as ThemeKey[];
const STEPS = ["Venue", "Service", "Tipping", "Look", "Tax", "Tables"];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [venueType, setVenueType] = useState("cafe");
  const [customerOrdering, setCustomerOrdering] = useState(true);
  const [customerPayment, setCustomerPayment] = useState(true);
  const [paymentTiming, setPaymentTiming] = useState<"before" | "after">("after");
  const [staffApproval, setStaffApproval] = useState(false);
  const [takeawayEnabled, setTakeawayEnabled] = useState(false);
  const [tipEnabled, setTipEnabled] = useState(false);
  const [theme, setTheme] = useState<ThemeKey>("warm");
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  const [abn, setAbn] = useState("");
  const [tableCount, setTableCount] = useState(8);
  const [sampleMenu, setSampleMenu] = useState(true);

  const last = STEPS.length - 1;

  function next() {
    setError(null);
    if (step === 0 && name.trim().length < 2) {
      setError("Enter your venue's name.");
      return;
    }
    if (step < last) setStep((s) => s + 1);
    else finish();
  }

  function finish() {
    setError(null);
    const answers: OnboardingAnswers = {
      restaurantName: name,
      venueType,
      customerOrdering,
      customerPayment,
      paymentTiming,
      staffApproval,
      takeawayEnabled,
      tipEnabled,
      theme,
      themeMode,
      abn,
      tableCount,
      sampleMenu,
    };
    start(async () => {
      const res = await completeOnboarding(answers);
      if (res.error) setError(res.error);
      else {
        router.push("/dashboard");
        router.refresh();
      }
    });
  }

  return (
    <main className="min-h-dvh bg-paper flex flex-col">
      <div className="w-full max-w-md mx-auto px-5 py-8 flex-1 flex flex-col">
        {/* Progress */}
        <div className="flex items-center gap-1.5 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i <= step ? "bg-pine" : "bg-line"
              }`}
            />
          ))}
        </div>

        <div className="flex-1">
          {step === 0 && (
            <Step
              title="Let's set up your venue"
              subtitle="A few quick questions and your ordering page is ready."
            >
              <label className="text-sm text-muted block mb-1">
                Venue name
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bluebird Café"
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 focus:border-pine focus:outline-none mb-5"
              />
              <p className="text-sm text-muted mb-2">What kind of venue is it?</p>
              <div className="grid grid-cols-2 gap-2">
                {VENUE_TYPES.map((v) => (
                  <Choice
                    key={v.value}
                    active={venueType === v.value}
                    onClick={() => setVenueType(v.value)}
                  >
                    {v.label}
                  </Choice>
                ))}
              </div>
            </Step>
          )}

          {step === 1 && (
            <Step
              title="How does service work?"
              subtitle="You can change any of this later in Settings."
            >
              <p className="text-sm font-medium mb-2">How do guests order?</p>
              <div className="space-y-2 mb-6">
                <ChoiceWide
                  active={customerOrdering}
                  onClick={() => setCustomerOrdering(true)}
                  title="They order from their phone"
                  desc="Scan the table QR, browse, and send to the kitchen."
                />
                <ChoiceWide
                  active={!customerOrdering}
                  onClick={() => setCustomerOrdering(false)}
                  title="Staff take the orders"
                  desc="The phone is a view-only menu; waiters enter orders."
                />
              </div>

              <p className="text-sm font-medium mb-2">How do guests pay?</p>
              <div className="space-y-2">
                <ChoiceWide
                  active={customerPayment}
                  onClick={() => setCustomerPayment(true)}
                  title="From their phone"
                  desc="Pay and split the bill themselves at the table."
                />
                <ChoiceWide
                  active={!customerPayment}
                  onClick={() => setCustomerPayment(false)}
                  title="At the counter / with staff"
                  desc="Staff close the bill when they pay."
                />
              </div>

              {customerPayment && (
                <>
                  <p className="text-sm font-medium mt-6 mb-2">When do they pay?</p>
                  <div className="space-y-2">
                    <ChoiceWide
                      active={paymentTiming === "after"}
                      onClick={() => setPaymentTiming("after")}
                      title="After — running tab"
                      desc="Order through the meal, pay when they're ready to leave."
                    />
                    <ChoiceWide
                      active={paymentTiming === "before"}
                      onClick={() => setPaymentTiming("before")}
                      title="Before — prepay"
                      desc="Pay when ordering; the kitchen ticket shows paid/unpaid. Good for counter service."
                    />
                  </div>
                </>
              )}

              <p className="text-sm font-medium mt-6 mb-2">
                Approve orders before the kitchen?
              </p>
              <div className="space-y-2">
                <ChoiceWide
                  active={!staffApproval}
                  onClick={() => setStaffApproval(false)}
                  title="No — straight to the kitchen"
                  desc="Fastest. Customers can still cancel before it's started."
                />
                <ChoiceWide
                  active={staffApproval}
                  onClick={() => setStaffApproval(true)}
                  title="Yes — staff accept each order first"
                  desc="Orders wait in an approval queue. A safeguard against mistaken or prank orders."
                />
              </div>

              <p className="text-sm font-medium mt-6 mb-2">
                Offer pickup / takeaway?
              </p>
              <div className="space-y-2">
                <ChoiceWide
                  active={!takeawayEnabled}
                  onClick={() => setTakeawayEnabled(false)}
                  title="Dine-in only"
                  desc="Guests order from their table."
                />
                <ChoiceWide
                  active={takeawayEnabled}
                  onClick={() => setTakeawayEnabled(true)}
                  title="Yes — accept pickup orders"
                  desc="Adds a pickup ordering link where guests order for collection with a pickup number."
                />
              </div>
            </Step>
          )}

          {step === 2 && (
            <Step
              title="Offer tipping?"
              subtitle="Uncommon in Australia — most venues leave this off."
            >
              <div className="space-y-2">
                <ChoiceWide
                  active={!tipEnabled}
                  onClick={() => setTipEnabled(false)}
                  title="No tipping"
                  desc="No tip prompt at checkout."
                />
                <ChoiceWide
                  active={tipEnabled}
                  onClick={() => setTipEnabled(true)}
                  title="Offer a tip at checkout"
                  desc="Suggests 5 / 10 / 15% — you can tune it later."
                />
              </div>
            </Step>
          )}

          {step === 3 && (
            <Step
              title="Pick a look"
              subtitle="This themes your customer ordering page. Fully editable later."
            >
              <div className="grid grid-cols-2 gap-2 mb-4">
                {THEME_KEYS.map((key) => {
                  const p = THEME_PRESETS[key];
                  const pal = themeMode === "dark" ? p.dark : p.light;
                  const active = theme === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setTheme(key)}
                      className={`text-left rounded-xl border-2 p-2.5 transition-colors ${
                        active ? "border-pine" : "border-line hover:border-ink/20"
                      }`}
                    >
                      <div
                        className="h-12 rounded-lg mb-2 flex items-center gap-1 px-2"
                        style={{
                          background: pal.paper,
                          border: `1px solid ${pal.line}`,
                        }}
                      >
                        <span
                          className="w-4 h-4 rounded-full"
                          style={{ background: p.defaultAccent }}
                        />
                        <span
                          className="flex-1 h-2 rounded"
                          style={{ background: pal.surface }}
                        />
                      </div>
                      <span className="text-xs font-medium block">{p.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="inline-flex rounded-lg border border-line p-0.5">
                {(["light", "dark"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setThemeMode(m)}
                    className={`px-4 py-1.5 text-sm rounded-md capitalize transition-colors ${
                      themeMode === m
                        ? "bg-pine text-[color:var(--on-accent,#fff)]"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </Step>
          )}

          {step === 4 && (
            <Step
              title="Tax details"
              subtitle="All menu prices include 10% GST. Your ABN prints on tax invoices."
            >
              <label className="text-sm text-muted block mb-1">
                ABN <span className="text-xs">(optional — add it anytime)</span>
              </label>
              <input
                value={abn}
                onChange={(e) => setAbn(e.target.value)}
                inputMode="numeric"
                placeholder="11 digits"
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 focus:border-pine focus:outline-none"
              />
            </Step>
          )}

          {step === 5 && (
            <Step
              title="Almost done"
              subtitle="We'll create your tables and QR codes now."
            >
              <label className="text-sm font-medium block mb-1">
                How many tables?
              </label>
              <p className="text-xs text-muted mb-2">
                Each gets its own QR code. Add or remove more anytime.
              </p>
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => setTableCount((n) => Math.max(0, n - 1))}
                  className="w-10 h-10 rounded-lg border border-line text-lg"
                >
                  −
                </button>
                <span className="w-12 text-center text-xl font-semibold tabular-nums">
                  {tableCount}
                </span>
                <button
                  onClick={() => setTableCount((n) => Math.min(50, n + 1))}
                  className="w-10 h-10 rounded-lg border border-line text-lg"
                >
                  +
                </button>
              </div>

              <p className="text-sm font-medium mb-2">Start with a sample menu?</p>
              <div className="space-y-2">
                <ChoiceWide
                  active={sampleMenu}
                  onClick={() => setSampleMenu(true)}
                  title="Yes, add a sample café menu"
                  desc="A few coffees and dishes to explore — edit or delete them."
                />
                <ChoiceWide
                  active={!sampleMenu}
                  onClick={() => setSampleMenu(false)}
                  title="No, I'll build my own"
                  desc="Start with an empty menu."
                />
              </div>
            </Step>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-danger-soft text-danger px-3.5 py-2.5 text-sm">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          {step > 0 && (
            <button
              onClick={() => {
                setError(null);
                setStep((s) => s - 1);
              }}
              disabled={pending}
              className="rounded-xl border border-line px-5 py-3 font-medium hover:border-ink/30 disabled:opacity-60"
            >
              Back
            </button>
          )}
          <button
            onClick={next}
            disabled={pending}
            className="flex-1 rounded-xl bg-pine text-[color:var(--on-accent,#fff)] py-3 font-medium hover:bg-pine-deep disabled:opacity-60"
          >
            {pending
              ? "Setting up…"
              : step === last
                ? "Create my venue"
                : "Continue"}
          </button>
        </div>
      </div>
    </main>
  );
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {title}
      </h1>
      <p className="text-muted text-sm mt-1 mb-6">{subtitle}</p>
      {children}
    </div>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-pine bg-pine-soft text-pine-deep"
          : "border-line hover:border-ink/20"
      }`}
    >
      {children}
    </button>
  );
}

function ChoiceWide({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 p-3.5 transition-colors ${
        active ? "border-pine bg-pine-soft" : "border-line hover:border-ink/20"
      }`}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="block text-xs text-muted mt-0.5">{desc}</span>
    </button>
  );
}
