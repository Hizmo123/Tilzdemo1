"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  completeOnboarding,
  saveOnboardingDraft,
  uploadOnboardingLogo,
} from "./actions";
import {
  defaultOnboardingAnswers,
  type OnboardingAnswers,
  type OnboardingDraftPayload,
  type ExperienceModeKey,
} from "@/lib/onboarding-options";
import type { ChecklistItem } from "@/lib/setup-checklist";
import { THEME_PRESETS, FONT_THEMES, ACCENT_SWATCHES, type ThemeKey, type FontKey, type CornerKey } from "@/lib/theme";
import { COUNTRIES, timezonesForCountry, currencyForCountry, hasTaxRules } from "@/lib/countries";
import { LANGUAGES } from "@/lib/languages";
import { compressImage } from "@/lib/compress-image";
import { VenueTypePicker } from "@/components/venue-setup/venue-type-picker";
import { ServiceStylePicker } from "@/components/venue-setup/service-style-picker";
import { ExperienceModePicker } from "@/components/venue-setup/experience-mode-picker";
import { CompactHoursPicker, type HoursPresetMode } from "@/components/venue-setup/compact-hours-picker";
import { SplitMethodsPicker } from "@/components/venue-setup/split-methods-picker";
import { CornerStylePicker } from "@/components/venue-setup/corner-style-picker";
import { CustomerPreview } from "@/components/venue-setup/customer-preview";
import { NotificationsPicker } from "@/components/venue-setup/notifications-picker";
import { PosPicker } from "@/components/venue-setup/pos-picker";

type StepId =
  | "location"
  | "venue"
  | "service_style"
  | "experience"
  | "tables"
  | "hours"
  | "menu"
  | "split"
  | "tipping"
  | "branding"
  | "tax"
  | "alerts"
  | "pos";

const STEP_TITLES: Record<StepId, string> = {
  location: "Location",
  venue: "Venue",
  service_style: "Service",
  experience: "Setup",
  tables: "Tables",
  hours: "Hours",
  menu: "Menu",
  split: "Splitting",
  tipping: "Tipping",
  branding: "Branding",
  tax: "Tax",
  alerts: "Alerts",
  pos: "POS",
};

function activeSteps(a: OnboardingAnswers): StepId[] {
  const steps: StepId[] = [
    "location",
    "venue",
    "service_style",
    "experience",
    "tables",
    "hours",
    "menu",
  ];
  if (a.customerPayment) steps.push("split");
  steps.push("tipping", "branding", "tax", "alerts", "pos");
  return steps;
}

const THEME_KEYS = Object.keys(THEME_PRESETS) as ThemeKey[];
const FONT_KEYS = Object.keys(FONT_THEMES) as FontKey[];

export function OnboardingWizard({
  initialDraft,
}: {
  initialDraft: OnboardingDraftPayload | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialDraft?.step ?? 0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    ...defaultOnboardingAnswers(),
    ...(initialDraft?.answers ?? {}),
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ checklist: ChecklistItem[] } | null>(null);

  function update(patch: Partial<OnboardingAnswers>) {
    setAnswers((a) => ({ ...a, ...patch }));
  }

  const steps = useMemo(() => activeSteps(answers), [answers]);
  const clampedStep = Math.min(step, steps.length - 1);
  const stepId = steps[clampedStep];
  const last = steps.length - 1;

  // Autosave the draft (debounced) after every change, so a refresh resumes
  // exactly here. Skipped on the very first render — nothing has changed yet.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const id = setTimeout(() => {
      saveOnboardingDraft({ step: clampedStep, answers }).catch(() => {
        /* best-effort — a failed autosave shouldn't interrupt the wizard */
      });
    }, 600);
    return () => clearTimeout(id);
  }, [answers, clampedStep]);

  function validateStep(id: StepId): string | null {
    if (id === "venue" && answers.restaurantName.trim().length < 2) {
      return "Enter your venue's name.";
    }
    return null;
  }

  function next() {
    const msg = validateStep(stepId);
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    if (clampedStep < last) setStep(clampedStep + 1);
    else finish();
  }

  function back() {
    setError(null);
    if (clampedStep > 0) setStep(clampedStep - 1);
  }

  function finish() {
    setError(null);
    setPending(true);
    completeOnboarding(answers)
      .then((res) => {
        setPending(false);
        if (res.error) setError(res.error);
        else setResult({ checklist: res.checklist ?? [] });
      })
      .catch(() => {
        setPending(false);
        setError("Something went wrong creating your venue. Please try again.");
      });
  }

  if (result) {
    return <FinishScreen checklist={result.checklist} restaurantName={answers.restaurantName} onDone={() => { router.push("/dashboard"); router.refresh(); }} />;
  }

  return (
    <main className="min-h-dvh bg-paper flex flex-col">
      <div className="w-full max-w-md mx-auto px-5 py-8 flex-1 flex flex-col">
        {/* Progress */}
        <div className="mb-2 flex items-center justify-between text-xs text-muted">
          <span>
            Step {clampedStep + 1} of {steps.length}
          </span>
          <span>{STEP_TITLES[stepId]}</span>
        </div>
        <div className="h-1.5 rounded-full bg-line mb-8 overflow-hidden">
          <div
            className="h-full rounded-full bg-pine transition-all duration-300"
            style={{ width: `${((clampedStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="flex-1">
          {stepId === "location" && (
            <Step
              title="Where are you?"
              subtitle="This decides your timezone options, currency, and which tax settings we ask about later."
            >
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted block mb-1">Country</label>
                  <select
                    value={answers.country}
                    onChange={(e) => {
                      const country = e.target.value;
                      const zones = timezonesForCountry(country);
                      update({
                        country,
                        currency: currencyForCountry(country),
                        timezone: zones.includes(answers.timezone) ? answers.timezone : zones[0],
                      });
                    }}
                    className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 focus:border-pine focus:outline-none"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted block mb-1">Timezone</label>
                  <select
                    value={answers.timezone}
                    onChange={(e) => update({ timezone: e.target.value })}
                    className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 focus:border-pine focus:outline-none"
                  >
                    {timezonesForCountry(answers.country).map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted block mb-1">Menu language</label>
                  <select
                    value={answers.language}
                    onChange={(e) => update({ language: e.target.value })}
                    className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 focus:border-pine focus:outline-none"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted mt-1">
                    Write your menu in this language — it&apos;s saved with your venue for reference.
                  </p>
                </div>
              </div>
            </Step>
          )}

          {stepId === "venue" && (
            <Step
              title="Let's set up your venue"
              subtitle="A few quick questions and your ordering page is ready."
            >
              <label className="text-sm text-muted block mb-1">Venue name</label>
              <input
                autoFocus
                value={answers.restaurantName}
                onChange={(e) => update({ restaurantName: e.target.value })}
                placeholder="e.g. Bluebird Café"
                className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 focus:border-pine focus:outline-none mb-5"
              />
              <p className="text-sm text-muted mb-2">What kind of venue is it?</p>
              <VenueTypePicker
                value={answers.venueType}
                onChange={(venueType) => update({ venueType })}
              />
            </Step>
          )}

          {stepId === "service_style" && (
            <Step
              title="How do your customers usually order?"
              subtitle="This just helps us tailor what comes next — you can mix things later."
            >
              <ServiceStylePicker
                value={answers.serviceStyle}
                onChange={(serviceStyle) => update({ serviceStyle })}
              />
            </Step>
          )}

          {stepId === "experience" && (
            <Step title="What should Tillz do for you?" subtitle="Pick the closest match — every setting stays editable later.">
              <ExperienceModePicker
                mode={answers.experienceMode}
                settings={{
                  customerOrdering: answers.customerOrdering,
                  customerPayment: answers.customerPayment,
                  paymentTiming: answers.paymentTiming,
                  staffApproval: answers.staffApproval,
                }}
                onChange={(mode: ExperienceModeKey, settings) =>
                  update({ experienceMode: mode, ...settings })
                }
              />
            </Step>
          )}

          {stepId === "tables" && (
            <Step title="How many tables?" subtitle="Each gets its own QR code. Add or remove more anytime.">
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => update({ tableCount: Math.max(0, answers.tableCount - 1) })}
                  className="w-10 h-10 rounded-lg border border-line text-lg"
                >
                  −
                </button>
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={answers.tableCount}
                  onChange={(e) =>
                    update({
                      tableCount: Math.max(0, Math.min(200, Number(e.target.value) || 0)),
                    })
                  }
                  className="w-20 text-center text-xl font-semibold tabular-nums rounded-lg border border-line bg-surface py-2"
                />
                <button
                  onClick={() => update({ tableCount: Math.min(200, answers.tableCount + 1) })}
                  className="w-10 h-10 rounded-lg border border-line text-lg"
                >
                  +
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {[5, 10, 20, 40].map((n) => (
                  <button
                    key={n}
                    onClick={() => update({ tableCount: n })}
                    className={`rounded-lg border-2 px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      answers.tableCount === n
                        ? "border-pine bg-pine-soft text-pine-deep"
                        : "border-line hover:border-ink/20"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted">
                {answers.tableCount > 0
                  ? `We'll create ${answers.tableCount} table${answers.tableCount === 1 ? "" : "s"} and their QR codes.`
                  : "No tables yet — you can add them anytime from Tables."}
              </p>
            </Step>
          )}

          {stepId === "hours" && (
            <Step title="When are you open?" subtitle="Ordering only opens during these hours. Customers can always browse the menu.">
              <CompactHoursPicker
                mode={answers.hoursMode}
                onModeChange={(hoursMode) => update({ hoursMode })}
                weekday={answers.hoursWeekday}
                onWeekdayChange={(hoursWeekday) => update({ hoursWeekday })}
                weekend={answers.hoursWeekend}
                onWeekendChange={(hoursWeekend) => update({ hoursWeekend })}
              />
            </Step>
          )}

          {stepId === "menu" && (
            <Step title="How should your menu be organised?" subtitle="You can always restructure this later in Menu.">
              <p className="text-sm font-medium mb-2">Start with a sample menu?</p>
              <div className="space-y-2 mb-6">
                <ChoiceWide
                  active={answers.sampleMenu}
                  onClick={() => update({ sampleMenu: true })}
                  title="Yes, add a sample café menu"
                  desc="A few coffees and dishes to explore — edit or delete them."
                />
                <ChoiceWide
                  active={!answers.sampleMenu}
                  onClick={() => update({ sampleMenu: false })}
                  title="No, I'll build my own"
                  desc="Start with an empty menu."
                />
              </div>

              {answers.sampleMenu && (
                <>
                  <p className="text-sm font-medium mb-2">Service periods</p>
                  <div className="space-y-2 mb-6">
                    <ChoiceWide
                      active={!answers.menuPeriods}
                      onClick={() => update({ menuPeriods: false })}
                      title="All-day menu"
                      desc="Everything's available whenever you're open."
                    />
                    <ChoiceWide
                      active={answers.menuPeriods}
                      onClick={() => update({ menuPeriods: true })}
                      title="Split by service period"
                      desc="e.g. a breakfast menu, then lunch — set per category."
                    />
                  </div>

                  <p className="text-sm font-medium mb-2">Kitchen routing</p>
                  <div className="space-y-2">
                    <ChoiceWide
                      active={!answers.menuStations}
                      onClick={() => update({ menuStations: false })}
                      title="One kitchen"
                      desc="Every ticket goes to the same board."
                    />
                    <ChoiceWide
                      active={answers.menuStations}
                      onClick={() => update({ menuStations: true })}
                      title="Kitchen + bar + coffee"
                      desc="Route tickets to the right station automatically."
                    />
                  </div>
                </>
              )}
            </Step>
          )}

          {stepId === "split" && (
            <Step title="How can guests split the bill?" subtitle="All four are on by default — turn off any you don't want to offer.">
              <SplitMethodsPicker
                value={answers.splitMethods}
                onChange={(splitMethods) => update({ splitMethods })}
              />
            </Step>
          )}

          {stepId === "tipping" && (
            <Step title="Offer tipping at checkout?" subtitle="Uncommon in Australia — most venues leave this off.">
              <div className="space-y-2 mb-4">
                <ChoiceWide
                  active={!answers.tipEnabled}
                  onClick={() => update({ tipEnabled: false })}
                  title="No tipping"
                  desc="No tip prompt at checkout."
                />
                <ChoiceWide
                  active={answers.tipEnabled}
                  onClick={() => update({ tipEnabled: true })}
                  title="Offer a tip at checkout"
                  desc="Suggests percentages — you can tune it later."
                />
              </div>
              {answers.tipEnabled && (
                <div>
                  <label className="text-sm text-muted block mb-1">
                    Suggested percentages (comma separated)
                  </label>
                  <input
                    value={answers.tipPresets.join(", ")}
                    onChange={(e) =>
                      update({
                        tipPresets: e.target.value
                          .split(",")
                          .map((s) => parseInt(s.trim(), 10))
                          .filter((n) => Number.isInteger(n) && n >= 1 && n <= 100),
                      })
                    }
                    placeholder="5, 10, 15"
                    className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 focus:border-pine focus:outline-none"
                  />
                </div>
              )}
            </Step>
          )}

          {stepId === "branding" && (
            <BrandingStep answers={answers} update={update} />
          )}

          {stepId === "tax" && (
            <Step
              title="Tax details"
              subtitle={
                hasTaxRules(answers.country)
                  ? "All menu prices include 10% GST. Your ABN prints on tax invoices."
                  : "We don't have tax rules for your country wired up yet — you can still set this venue up, and add tax details later once we do."
              }
            >
              {hasTaxRules(answers.country) ? (
                <div>
                  <label className="text-sm text-muted block mb-1">
                    ABN <span className="text-xs">(optional — add it anytime)</span>
                  </label>
                  <input
                    value={answers.abn}
                    onChange={(e) => update({ abn: e.target.value })}
                    inputMode="numeric"
                    placeholder="11 digits"
                    className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 focus:border-pine focus:outline-none"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-line bg-paper px-3.5 py-3 text-sm text-muted">
                  Currency ({answers.currency}) and timezone ({answers.timezone.replace("_", " ")})
                  are already set from the country you picked earlier — nothing else to fill in here yet.
                </div>
              )}
            </Step>
          )}

          {stepId === "alerts" && (
            <Step title="How should your team hear about new orders?" subtitle="Only what Tillz actually does today.">
              <NotificationsPicker
                kitchenChime={answers.kitchenChime}
                onKitchenChimeChange={(kitchenChime) => update({ kitchenChime })}
                orderReadySmsEnabled={answers.orderReadySmsEnabled}
                onOrderReadySmsChange={(orderReadySmsEnabled) => update({ orderReadySmsEnabled })}
              />
            </Step>
          )}

          {stepId === "pos" && (
            <Step title="Do you use Square?" subtitle="Square is the only POS with a real connection on our roadmap, so it's the only one we ask about.">
              <PosPicker
                usesSquare={
                  answers.posProvider === "square"
                    ? true
                    : answers.posProvider === "none"
                      ? false
                      : null
                }
                wantsConnect={answers.squareConnectInterest}
                onUsesSquareChange={(usesSquare) =>
                  update({
                    posProvider: usesSquare ? "square" : "none",
                    squareConnectInterest: usesSquare ? answers.squareConnectInterest : false,
                  })
                }
                onWantsConnectChange={(squareConnectInterest) => update({ squareConnectInterest })}
              />
            </Step>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-danger-soft text-danger px-3.5 py-2.5 text-sm">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          {clampedStep > 0 && (
            <button
              onClick={back}
              disabled={pending}
              className="rounded-xl border border-line px-5 py-3 font-medium hover:border-ink/30 disabled:opacity-60"
            >
              Back
            </button>
          )}
          {stepId === "pos" && (
            <button
              onClick={finish}
              disabled={pending}
              className="text-sm text-muted hover:text-ink px-2"
            >
              Skip
            </button>
          )}
          <button
            onClick={next}
            disabled={pending}
            className="flex-1 rounded-xl bg-pine text-[color:var(--on-accent,#fff)] py-3 font-medium hover:bg-pine-deep disabled:opacity-60"
          >
            {pending ? "Setting up…" : clampedStep === last ? "Create my venue" : "Continue"}
          </button>
        </div>
      </div>
    </main>
  );
}

function BrandingStep({
  answers,
  update,
}: {
  answers: OnboardingAnswers;
  update: (patch: Partial<OnboardingAnswers>) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onLogoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setUploading(true);
    try {
      const blob = await compressImage(file, 400, 0.9);
      const fd = new FormData();
      fd.append("file", blob, "logo.jpg");
      const res = await uploadOnboardingLogo(fd);
      if ("error" in res) {
        setUploadError(res.error);
        setLocalPreview(null);
      } else {
        update({ logoUrl: res.url });
      }
    } catch {
      setUploadError("Couldn't process that image.");
      setLocalPreview(null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  }

  return (
    <Step title="Make it yours." subtitle="This themes your customer ordering page. Fully editable later in Settings.">
      <div className="grid sm:grid-cols-[1fr_auto] gap-6 items-start">
        <div className="space-y-5">
          <div>
            <label className="text-sm text-muted block mb-2">Logo</label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg border border-line bg-paper overflow-hidden flex items-center justify-center shrink-0">
                {localPreview || answers.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={localPreview ?? answers.logoUrl ?? ""}
                    alt=""
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-muted">Logo</span>
                )}
              </div>
              <label className="text-sm rounded-md border border-line px-3 py-1.5 hover:border-ink/30 cursor-pointer">
                {uploading ? "Uploading…" : "Upload logo"}
                <input type="file" accept="image/*" onChange={onLogoPick} className="hidden" disabled={uploading} />
              </label>
            </div>
            {uploadError && <p className="text-xs text-danger mt-1.5">{uploadError}</p>}
          </div>

          <div>
            <label className="text-sm text-muted block mb-2">Tagline (optional)</label>
            <input
              value={answers.tagline}
              onChange={(e) => update({ tagline: e.target.value })}
              placeholder="e.g. Slow coffee, fast Wi-Fi"
              maxLength={80}
              className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 focus:border-pine focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-muted block mb-2">Accent colour</label>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => update({ brandColor: c })}
                  aria-label={`Accent ${c}`}
                  className={`w-8 h-8 rounded-full border-2 ${
                    answers.brandColor.toLowerCase() === c.toLowerCase()
                      ? "border-ink"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="flex items-center gap-1.5 ml-1 text-xs text-muted cursor-pointer">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(answers.brandColor) ? answers.brandColor : "#0f5c42"}
                  onChange={(e) => update({ brandColor: e.target.value })}
                  className="w-8 h-8 rounded-full border border-line bg-transparent cursor-pointer p-0"
                  aria-label="Custom accent colour"
                />
                Custom
              </label>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted block mb-2">Theme</label>
            <div className="grid grid-cols-2 gap-2">
              {THEME_KEYS.map((key) => {
                const p = THEME_PRESETS[key];
                const pal = answers.themeMode === "dark" ? p.dark : p.light;
                const active = answers.theme === key;
                return (
                  <button
                    key={key}
                    onClick={() => update({ theme: key })}
                    className={`text-left rounded-xl border-2 p-2.5 transition-colors ${
                      active ? "border-pine" : "border-line hover:border-ink/20"
                    }`}
                  >
                    <div
                      className="h-10 rounded-lg mb-2 flex items-center gap-1 px-2"
                      style={{ background: pal.paper, border: `1px solid ${pal.line}` }}
                    >
                      <span
                        className="w-4 h-4 rounded-full"
                        style={{ background: answers.brandColor || p.defaultAccent }}
                      />
                      <span className="flex-1 h-2 rounded" style={{ background: pal.surface }} />
                    </div>
                    <span className="text-xs font-medium block">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="inline-flex rounded-lg border border-line p-0.5">
              {(["light", "dark"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => update({ themeMode: m })}
                  className={`px-3.5 py-1.5 text-sm rounded-md capitalize transition-colors ${
                    answers.themeMode === m
                      ? "bg-pine text-[color:var(--on-accent,#fff)]"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-muted block mb-2">Font</label>
            <div className="grid grid-cols-3 gap-2">
              {FONT_KEYS.map((key) => {
                const f = FONT_THEMES[key];
                const active = answers.fontTheme === key;
                return (
                  <button
                    key={key}
                    onClick={() => update({ fontTheme: key })}
                    className={`rounded-xl border-2 p-3 min-w-0 overflow-hidden transition-colors ${
                      active ? "border-pine" : "border-line hover:border-ink/20"
                    }`}
                  >
                    <span
                      className="block text-lg font-semibold leading-none truncate"
                      style={{ fontFamily: f.display }}
                    >
                      Ag
                    </span>
                    <span className="block text-xs text-muted mt-2 truncate">{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm text-muted block mb-2">Corner style</label>
            <CornerStylePicker
              value={answers.cornerStyle as CornerKey}
              onChange={(cornerStyle) => update({ cornerStyle })}
            />
          </div>
        </div>

        <div className="hidden sm:block sticky top-4">
          <CustomerPreview
            appearance={{
              theme: answers.theme,
              themeMode: answers.themeMode,
              fontTheme: answers.fontTheme,
              brandColor: answers.brandColor,
              cornerStyle: answers.cornerStyle,
            }}
            restaurantName={answers.restaurantName}
            tagline={answers.tagline}
            logoUrl={localPreview ?? answers.logoUrl}
            phoneFrame
          />
        </div>
      </div>
    </Step>
  );
}

function FinishScreen({
  checklist,
  restaurantName,
  onDone,
}: {
  checklist: ChecklistItem[];
  restaurantName: string;
  onDone: () => void;
}) {
  const remaining = checklist.filter((c) => !c.done);
  return (
    <main className="min-h-dvh bg-paper flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-pine-soft text-pine-deep flex items-center justify-center mx-auto mb-4 text-2xl">
            ✓
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {restaurantName || "Your venue"} is ready
          </h1>
          <p className="text-muted text-sm mt-1">
            Here&apos;s what&apos;s left before you open the doors.
          </p>
        </div>

        <ul className="rounded-[var(--radius-card)] border border-line bg-surface divide-y divide-line mb-6">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${
                  item.done ? "bg-pine border-pine text-white" : "border-line text-transparent"
                }`}
              >
                ✓
              </span>
              {item.href && !item.done ? (
                <Link href={item.href} className="text-sm text-ink hover:text-pine flex-1">
                  {item.label}
                </Link>
              ) : (
                <span className={`text-sm flex-1 ${item.done ? "text-muted" : "text-ink"}`}>
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ul>

        <button
          onClick={onDone}
          className="w-full rounded-xl bg-pine text-[color:var(--on-accent,#fff)] py-3 font-medium hover:bg-pine-deep"
        >
          {remaining.length > 0 ? "Go to dashboard" : "Take me to the dashboard"}
        </button>
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
      <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted text-sm mt-1 mb-6">{subtitle}</p>
      {children}
    </div>
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
