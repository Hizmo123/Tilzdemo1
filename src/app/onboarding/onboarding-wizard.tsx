"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PlanTier } from "@prisma/client";
import { motion, useReducedMotion } from "motion/react";
import {
  completeOnboarding,
  completeOnboardingForExistingOrg,
  saveOnboardingDraft,
  uploadOnboardingImage,
} from "./actions";
import { defaultCardStyle } from "@/lib/menu-style";
import {
  defaultOnboardingAnswers,
  planAllowsOrdering,
  planRequiresSquare,
  EXPERIENCE_MODES,
  type OnboardingAnswers,
  type OnboardingDraftPayload,
  type ExperienceModeKey,
} from "@/lib/onboarding-options";
import type { PendingSquareSummary, OrgSquareConnectionSummary } from "@/lib/square/pending";
import type { ChecklistItem } from "@/lib/setup-checklist";
import { THEME_PRESETS, FONT_THEMES, ACCENT_SWATCHES, type ThemeKey, type FontKey, type CornerKey } from "@/lib/theme";
import { COUNTRIES, timezonesForCountry, currencyForCountry, hasTaxRules } from "@/lib/countries";
import { LANGUAGES } from "@/lib/languages";
import { compressImage } from "@/lib/compress-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Chip, SegmentedControl } from "@/components/ui/chip";
import { celebrate } from "@/components/ui/confetti";
import { SPRING, fadeUp, stagger } from "@/components/ui/motion";
import { ChoiceCard, OptionTile } from "@/components/venue-setup/choice";
import { VenueTypePicker } from "@/components/venue-setup/venue-type-picker";
import { ExperienceModePicker } from "@/components/venue-setup/experience-mode-picker";
import { CompactHoursPicker } from "@/components/venue-setup/compact-hours-picker";
import { SplitMethodsPicker } from "@/components/venue-setup/split-methods-picker";
import { CornerStylePicker } from "@/components/venue-setup/corner-style-picker";
import { CustomerPreview } from "@/components/venue-setup/customer-preview";
import { NotificationsPicker } from "@/components/venue-setup/notifications-picker";
import { PlanPicker } from "@/components/venue-setup/plan-picker";
import { MenuLayoutPicker } from "@/components/venue-setup/menu-layout-picker";
import type { SquareResult } from "./square-result";
import { PaymentsStep } from "./steps/payments-step";
import {
  Stepper,
  StepPanel,
  StepFrame,
  FieldLabel,
  SelectField,
  NumberStepper,
  ImageUploadTile,
  WizardError,
} from "./wizard-ui";

type StepId =
  | "location"
  | "venue"
  | "plan"
  | "experience"
  | "payments"
  | "tables"
  | "hours"
  | "menu"
  | "split"
  | "tipping"
  | "branding"
  | "tax"
  | "alerts";

const STEP_TITLES: Record<StepId, string> = {
  location: "Location",
  venue: "Venue",
  plan: "Plan",
  experience: "Setup",
  payments: "Payments",
  tables: "Tables",
  hours: "Hours",
  menu: "Menu",
  split: "Splitting",
  tipping: "Tipping",
  branding: "Branding",
  tax: "Tax",
  alerts: "Alerts",
};

// Which steps this run of the wizard shows, given the answers so far. The
// plan decides most of it: Lite is menu-only, so every ordering/payment step
// (experience, payments, tables, split, tipping, tax, kitchen alerts) is
// skipped outright — same pattern the split step already used for
// customerPayment. `fixedPlan` is the "+ Add venue" flow: the org already
// has a tier, so there's no plan step and that tier is what gates the rest.
function activeSteps(a: OnboardingAnswers, fixedPlan?: PlanTier): StepId[] {
  const tier = fixedPlan ?? a.plan;
  const ordering = planAllowsOrdering(tier);
  // Connect's whole model is a Square connection, so its Payments step is
  // never skippable — shown regardless of the customerPayment toggle
  // (choosePlan forces that toggle on anyway, but this doesn't rely on it).
  const squareMandatory = planRequiresSquare(tier);
  const steps: StepId[] = ["location", "venue"];
  if (!fixedPlan) steps.push("plan");
  if (ordering) {
    steps.push("experience");
    if (a.customerPayment || squareMandatory) steps.push("payments");
    steps.push("tables");
  }
  steps.push("hours", "menu");
  if (ordering && a.customerPayment) steps.push("split", "tipping");
  steps.push("branding");
  if (ordering) steps.push("tax", "alerts");
  return steps;
}

const THEME_KEYS = Object.keys(THEME_PRESETS) as ThemeKey[];
const FONT_KEYS = Object.keys(FONT_THEMES) as FontKey[];

// How long "Venue created" holds on the button before the checklist screen
// takes over — long enough to register, short enough to never feel like a
// wait.
const CREATED_HOLD_MS = 900;

export function OnboardingWizard({
  initialDraft,
  organizationId,
  fixedPlan,
  initialSquare,
  existingOrgSquare,
  squareResult,
  returnTo,
}: {
  initialDraft: OnboardingDraftPayload | null;
  // Set only by task G's "+ Add venue" flow (/venues/new) — when present,
  // finish() attaches the new restaurant to THIS existing organisation
  // instead of creating a brand-new org + membership. The wizard's steps,
  // draft-resume, and UI are otherwise completely unchanged between the two
  // modes; only which server action completes it differs.
  organizationId?: string;
  // The existing org's tier, in that same flow — replaces the plan step.
  fixedPlan?: PlanTier;
  // Square connected mid-wizard (PendingSquareConnection), if any — set by
  // the page from the server; kept in state here as the Payments step
  // changes it (location pick, disconnect).
  initialSquare: PendingSquareSummary | null;
  // +Add venue only (task 5): a live SquareConnection elsewhere in this org,
  // if any — lets the Payments step offer "Use <merchant>" instead of a
  // fresh OAuth click-through. Always undefined/null on first-run
  // onboarding, which has no existing org to have one.
  existingOrgSquare?: OrgSquareConnectionSummary | null;
  // Present only on the render right after the Square OAuth round trip
  // lands back here. Consumed once, then stripped from the URL.
  squareResult: SquareResult | null;
  returnTo: "/onboarding" | "/venues/new";
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialDraft?.step ?? 0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [answers, setAnswers] = useState<OnboardingAnswers>({
    // Every key has a default, so a draft saved before a step existed (plan,
    // payments, cover, …) resumes with sensible values instead of undefined.
    ...defaultOnboardingAnswers(),
    ...(initialDraft?.answers ?? {}),
  });
  const [square, setSquare] = useState<PendingSquareSummary | null>(initialSquare);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ checklist: ChecklistItem[] } | null>(null);

  function update(patch: Partial<OnboardingAnswers>) {
    setAnswers((a) => ({ ...a, ...patch }));
  }

  // Picking a plan can change what the later steps even mean: Lite has no
  // ordering, so its experience is fixed to the digital-menu preset; coming
  // back OFF Lite restores the wizard's normal order-and-pay default so the
  // experience step isn't silently stuck on menu-only.
  function choosePlan(plan: PlanTier) {
    const ordering = planAllowsOrdering(plan);
    if (!ordering) {
      update({ plan, experienceMode: "digital_menu", ...EXPERIENCE_MODES.digital_menu.settings });
    } else if (planRequiresSquare(plan)) {
      // Connect's product IS "orders + payments go to your Square" — force
      // both on regardless of what a previously-chosen tier's custom
      // toggles left them at, and lock the Payments step to the Square
      // path so it never silently offers the Tillz-payments alternative.
      update({
        plan,
        paymentPath: "square",
        experienceMode: answers.experienceMode === "digital_menu" ? "order_and_pay" : answers.experienceMode,
        customerOrdering: true,
        customerPayment: true,
      });
    } else if (answers.experienceMode === "digital_menu" && !planAllowsOrdering(answers.plan)) {
      update({ plan, experienceMode: "order_and_pay", ...EXPERIENCE_MODES.order_and_pay.settings });
    } else {
      update({ plan });
    }
  }

  const steps = useMemo(() => activeSteps(answers, fixedPlan), [answers, fixedPlan]);
  const clampedStep = Math.min(step, steps.length - 1);
  const stepId = steps[clampedStep];
  const last = steps.length - 1;
  const ordering = planAllowsOrdering(fixedPlan ?? answers.plan);
  const squareMandatory = planRequiresSquare(fixedPlan ?? answers.plan);

  // Landing back from Square: make sure we're on the Payments step (the
  // draft normally puts us there already — this covers a failed draft save),
  // then drop ?square=… from the URL so a refresh doesn't replay the result.
  const squareHandled = useRef(false);
  useEffect(() => {
    if (!squareResult || squareHandled.current) return;
    squareHandled.current = true;
    const idx = steps.indexOf("payments");
    if (idx >= 0 && idx !== clampedStep) setStep(idx);
    router.replace(returnTo, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squareResult]);

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
    if (id === "payments" && (squareMandatory || answers.paymentPath === "square")) {
      if (!square) {
        return squareMandatory
          ? "Connect your Square account to continue — required on the Connect plan."
          : "Connect your Square account, or choose Tillz payments to continue.";
      }
      if (!square.locationId) return "Choose which Square location this venue is.";
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
    setDir(1);
    if (clampedStep < last) setStep(clampedStep + 1);
    else finish();
  }

  function back() {
    setError(null);
    setDir(-1);
    if (clampedStep > 0) setStep(clampedStep - 1);
  }

  // Submit → button becomes a spinner (double-submit impossible: it's
  // disabled) → "Venue created" with a tick for a beat → checklist screen.
  // Never an instant redirect with no feedback.
  function finish() {
    if (pending || created) return;
    setError(null);
    setPending(true);
    const complete = organizationId
      ? completeOnboardingForExistingOrg(organizationId, answers)
      : completeOnboarding(answers);
    complete
      .then((res) => {
        setPending(false);
        if (res.error) {
          setError(res.error);
          return;
        }
        setCreated(true);
        setTimeout(() => setResult({ checklist: res.checklist ?? [] }), CREATED_HOLD_MS);
      })
      .catch(() => {
        setPending(false);
        setError("Something went wrong creating your venue. Please try again.");
      });
  }

  if (result) {
    return (
      <FinishScreen
        checklist={result.checklist}
        restaurantName={answers.restaurantName}
        brandColor={answers.brandColor}
        onDone={() => {
          router.push("/dashboard");
          router.refresh();
        }}
      />
    );
  }

  // The plan cards need room to sit two-up; every other step reads best at
  // the narrower form width.
  const wide = stepId === "plan";
  const busy = pending || created;

  return (
    <main className="min-h-dvh bg-paper flex flex-col">
      <div className={`w-full mx-auto px-5 py-8 flex-1 flex flex-col transition-[max-width] duration-[var(--dur-base)] ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <Stepper steps={steps.map((id) => ({ id, label: STEP_TITLES[id] }))} current={clampedStep} />

        <div className="flex-1">
          <StepPanel stepKey={stepId} direction={dir}>
            {stepId === "location" && (
              <StepFrame
                title="Where are you?"
                subtitle="This decides your timezone options, currency, and which tax settings we ask about later."
              >
                <div className="space-y-4">
                  <SelectField
                    label="Country"
                    value={answers.country}
                    onChange={(country) => {
                      const zones = timezonesForCountry(country);
                      update({
                        country,
                        currency: currencyForCountry(country),
                        timezone: zones.includes(answers.timezone) ? answers.timezone : zones[0],
                      });
                    }}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField label="Timezone" value={answers.timezone} onChange={(timezone) => update({ timezone })}>
                    {timezonesForCountry(answers.country).map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace("_", " ")}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="Menu language"
                    value={answers.language}
                    onChange={(language) => update({ language })}
                    helper="Write your menu in this language — it's saved with your venue for reference."
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ))}
                  </SelectField>
                </div>
              </StepFrame>
            )}

            {stepId === "venue" && (
              <StepFrame title="Let's set up your venue" subtitle="A few quick questions and your ordering page is ready.">
                <div className="mb-5">
                  <FieldLabel htmlFor="venue-name">Venue name</FieldLabel>
                  <Input
                    id="venue-name"
                    autoFocus
                    value={answers.restaurantName}
                    onChange={(e) => update({ restaurantName: e.target.value })}
                    placeholder="e.g. Bluebird Café"
                    invalid={!!error && answers.restaurantName.trim().length < 2}
                  />
                </div>
                <p className="text-sm font-medium text-ink-soft mb-2">What kind of venue is it?</p>
                <VenueTypePicker value={answers.venueType} onChange={(venueType) => update({ venueType })} />
              </StepFrame>
            )}

            {stepId === "plan" && (
              <StepFrame
                title="Choose your plan"
                subtitle="Start on Lite with a digital menu, or go live with ordering straight away. Test mode — no card needed, switch any time from Billing."
              >
                <PlanPicker value={answers.plan} onChange={choosePlan} />
              </StepFrame>
            )}

            {stepId === "experience" && (
              <StepFrame title="What should Tillz do for you?" subtitle="Pick the closest match — every setting stays editable later.">
                <ExperienceModePicker
                  mode={answers.experienceMode}
                  settings={{
                    customerOrdering: answers.customerOrdering,
                    customerPayment: answers.customerPayment,
                    paymentTiming: answers.paymentTiming,
                    staffApproval: answers.staffApproval,
                  }}
                  onChange={(mode: ExperienceModeKey, settings) =>
                    // Connect can't turn ordering/payment off via Custom —
                    // the whole tier is "orders + payments go to Square".
                    update({
                      experienceMode: mode,
                      ...settings,
                      ...(squareMandatory ? { customerOrdering: true, customerPayment: true } : {}),
                    })
                  }
                />
              </StepFrame>
            )}

            {stepId === "payments" && (
              <StepFrame
                title={squareMandatory ? "Connect Square" : "How will you take payments?"}
                subtitle={
                  squareMandatory
                    ? "Connect runs entirely on your own Square account — this step is required to finish setting up."
                    : "Connect the Square account you already use, or run on Tillz's own payment flow. You can change this later in Settings → Integrations."
                }
              >
                <PaymentsStep
                  answers={answers}
                  update={update}
                  square={square}
                  onSquareChange={setSquare}
                  existingOrgSquare={existingOrgSquare ?? null}
                  squareResult={squareResult}
                  returnTo={returnTo}
                  mandatory={squareMandatory}
                  onBeforeRedirect={async () => {
                    // Square's consent screen leaves the wizard; the draft is
                    // how we come back to exactly this step with everything
                    // intact.
                    await saveOnboardingDraft({
                      step: clampedStep,
                      answers: { ...answers, paymentPath: "square" },
                    });
                  }}
                />
              </StepFrame>
            )}

            {stepId === "tables" && (
              <StepFrame title="How many tables?" subtitle="Each gets its own QR code. Add or remove more anytime.">
                <div className="mb-4">
                  <NumberStepper value={answers.tableCount} onChange={(tableCount) => update({ tableCount })} label="tables" />
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {[5, 10, 20, 40].map((n) => (
                    <Chip key={n} selected={answers.tableCount === n} onClick={() => update({ tableCount: n })}>
                      {n}
                    </Chip>
                  ))}
                </div>
                <p className="text-sm text-muted">
                  {answers.tableCount > 0
                    ? `We'll create ${answers.tableCount} table${answers.tableCount === 1 ? "" : "s"} and their QR codes.`
                    : "No tables yet — you can add them anytime from Tables."}
                </p>
              </StepFrame>
            )}

            {stepId === "hours" && (
              <StepFrame title="When are you open?" subtitle="Ordering only opens during these hours. Customers can always browse the menu.">
                <CompactHoursPicker
                  mode={answers.hoursMode}
                  onModeChange={(hoursMode) => update({ hoursMode })}
                  weekday={answers.hoursWeekday}
                  onWeekdayChange={(hoursWeekday) => update({ hoursWeekday })}
                  weekend={answers.hoursWeekend}
                  onWeekendChange={(hoursWeekend) => update({ hoursWeekend })}
                />
              </StepFrame>
            )}

            {stepId === "menu" && (
              <StepFrame title="How should your menu be organised?" subtitle="You can always restructure this later in Menu.">
                <p className="text-sm font-medium text-ink-soft mb-2">Start with a sample menu?</p>
                <div role="radiogroup" className="space-y-2 mb-6">
                  <ChoiceCard
                    selected={answers.sampleMenu}
                    onClick={() => update({ sampleMenu: true })}
                    title="Yes, add a sample café menu"
                    desc="A few coffees and dishes to explore — edit or delete them."
                  />
                  <ChoiceCard
                    selected={!answers.sampleMenu}
                    onClick={() => update({ sampleMenu: false })}
                    title="No, I'll build my own"
                    desc="Start with an empty menu."
                  />
                </div>

                {answers.sampleMenu && (
                  <>
                    <p className="text-sm font-medium text-ink-soft mb-2">Service periods</p>
                    <div role="radiogroup" className="space-y-2 mb-6">
                      <ChoiceCard
                        selected={!answers.menuPeriods}
                        onClick={() => update({ menuPeriods: false })}
                        title="All-day menu"
                        desc="Everything's available whenever you're open."
                      />
                      <ChoiceCard
                        selected={answers.menuPeriods}
                        onClick={() => update({ menuPeriods: true })}
                        title="Split by service period"
                        desc="e.g. a breakfast menu, then lunch — set per category."
                      />
                    </div>

                    {/* Lite has no kitchen screen — nothing to route to. */}
                    {ordering && (
                      <>
                        <p className="text-sm font-medium text-ink-soft mb-2">Kitchen routing</p>
                        <div role="radiogroup" className="space-y-2">
                          <ChoiceCard
                            selected={!answers.menuStations}
                            onClick={() => update({ menuStations: false })}
                            title="One kitchen"
                            desc="Every ticket goes to the same board."
                          />
                          <ChoiceCard
                            selected={answers.menuStations}
                            onClick={() => update({ menuStations: true })}
                            title="Kitchen + bar + coffee"
                            desc="Route tickets to the right station automatically."
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </StepFrame>
            )}

            {stepId === "split" && (
              <StepFrame title="How can guests split the bill?" subtitle="All four are on by default — turn off any you don't want to offer.">
                <SplitMethodsPicker value={answers.splitMethods} onChange={(splitMethods) => update({ splitMethods })} />
              </StepFrame>
            )}

            {stepId === "tipping" && (
              <StepFrame title="Offer tipping at checkout?" subtitle="Uncommon in Australia — most venues leave this off.">
                <div role="radiogroup" className="space-y-2 mb-4">
                  <ChoiceCard
                    selected={!answers.tipEnabled}
                    onClick={() => update({ tipEnabled: false })}
                    title="No tipping"
                    desc="No tip prompt at checkout."
                  />
                  <ChoiceCard
                    selected={answers.tipEnabled}
                    onClick={() => update({ tipEnabled: true })}
                    title="Offer a tip at checkout"
                    desc="Suggests percentages — you can tune it later."
                  />
                </div>
                {answers.tipEnabled && (
                  <div>
                    <FieldLabel htmlFor="tip-presets" hint="(comma separated)">
                      Suggested percentages
                    </FieldLabel>
                    <Input
                      id="tip-presets"
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
                    />
                  </div>
                )}
              </StepFrame>
            )}

            {stepId === "branding" && <BrandingStep answers={answers} update={update} />}

            {stepId === "tax" && (
              <StepFrame
                title="Tax details"
                subtitle={
                  hasTaxRules(answers.country)
                    ? "All menu prices include 10% GST. Your ABN prints on tax invoices."
                    : "We don't have tax rules for your country wired up yet — you can still set this venue up, and add tax details later once we do."
                }
              >
                {hasTaxRules(answers.country) ? (
                  <div>
                    <FieldLabel htmlFor="abn" hint="(optional — add it anytime)">
                      ABN
                    </FieldLabel>
                    <Input id="abn" value={answers.abn} onChange={(e) => update({ abn: e.target.value })} inputMode="numeric" placeholder="11 digits" />
                  </div>
                ) : (
                  <div className="rounded-[var(--radius-md)] bg-surface-2/60 px-3.5 py-3 text-sm text-muted">
                    Currency ({answers.currency}) and timezone ({answers.timezone.replace("_", " ")}) are already set from the country you picked earlier — nothing else to fill in here yet.
                  </div>
                )}
              </StepFrame>
            )}

            {stepId === "alerts" && (
              <StepFrame title="How should your team hear about new orders?" subtitle="Only what Tillz actually does today.">
                <NotificationsPicker kitchenChime={answers.kitchenChime} onKitchenChimeChange={(kitchenChime) => update({ kitchenChime })} />
              </StepFrame>
            )}
          </StepPanel>
        </div>

        <WizardError>{error}</WizardError>

        <div className="mt-6 flex items-center gap-3">
          {clampedStep > 0 && (
            <Button variant="secondary" size="lg" onClick={back} disabled={busy}>
              Back
            </Button>
          )}
          {clampedStep === last && !busy && (
            <Button variant="ghost" size="lg" onClick={finish} className="px-3">
              Skip
            </Button>
          )}
          <Button size="lg" onClick={next} loading={pending} disabled={created} className="flex-1">
            {created ? (
              <span className="inline-flex items-center gap-2">
                <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <motion.path d="M4 10.5l3.5 3.5L16 6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3 }} />
                </svg>
                Venue created
              </span>
            ) : pending ? (
              "Creating your venue…"
            ) : clampedStep === last ? (
              "Create my venue"
            ) : (
              "Continue"
            )}
          </Button>
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
  const logo = useOnboardingImage("logo", answers.logoUrl, (logoUrl) => update({ logoUrl }));
  const cover = useOnboardingImage("cover", answers.coverUrl, (coverUrl) => update({ coverUrl }));

  return (
    <StepFrame title="Make it yours." subtitle="This themes your customer ordering page. Fully editable later in Settings.">
      <div className="grid sm:grid-cols-[1fr_auto] gap-6 items-start">
        <div className="space-y-5 min-w-0">
          <ImageUploadTile
            shape="square"
            label="Logo"
            emptyText="Logo"
            preview={logo.preview}
            uploading={logo.uploading}
            error={logo.error}
            onPick={logo.onPick}
            hasStored={!!answers.logoUrl}
            onRemove={() => update({ logoUrl: null })}
          />

          <ImageUploadTile
            shape="wide"
            label="Cover photo"
            hint="(optional — the hero behind your name)"
            emptyText="No cover yet — we'll use your accent colour"
            preview={cover.preview}
            uploading={cover.uploading}
            error={cover.error}
            onPick={cover.onPick}
            hasStored={!!answers.coverUrl}
            onRemove={() => update({ coverUrl: null })}
          />

          <div>
            <FieldLabel>Menu layout</FieldLabel>
            <MenuLayoutPicker value={answers.menuLayout} onChange={(menuLayout) => update({ menuLayout })} />
          </div>

          <div>
            <FieldLabel htmlFor="tagline" hint="(optional)">
              Tagline
            </FieldLabel>
            <Input
              id="tagline"
              value={answers.tagline}
              onChange={(e) => update({ tagline: e.target.value })}
              placeholder="e.g. Slow coffee, fast Wi-Fi"
              maxLength={80}
            />
          </div>

          <div>
            <FieldLabel>Accent colour</FieldLabel>
            <div role="radiogroup" className="flex flex-wrap items-center gap-2">
              {ACCENT_SWATCHES.map((c) => {
                const on = answers.brandColor.toLowerCase() === c.toLowerCase();
                return (
                  <motion.button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => update({ brandColor: c })}
                    aria-label={`Accent ${c}`}
                    whileTap={{ scale: 0.9 }}
                    transition={SPRING}
                    animate={{ scale: on ? 1.08 : 1 }}
                    className={`w-9 h-9 rounded-pill ring-offset-2 ring-offset-paper transition-shadow duration-[var(--dur-fast)] ${
                      on ? "ring-2 ring-ink shadow-raised" : "ring-1 ring-black/10 hover:ring-black/25"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                );
              })}
              <label className="flex items-center gap-1.5 ml-1 text-xs text-muted cursor-pointer">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(answers.brandColor) ? answers.brandColor : "#0f5c42"}
                  onChange={(e) => update({ brandColor: e.target.value })}
                  className="w-9 h-9 rounded-pill border border-line bg-transparent cursor-pointer p-0"
                  aria-label="Custom accent colour"
                />
                Custom
              </label>
            </div>
          </div>

          <div>
            <FieldLabel>Theme</FieldLabel>
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {THEME_KEYS.map((key) => {
                const p = THEME_PRESETS[key];
                const pal = answers.themeMode === "dark" ? p.dark : p.light;
                return (
                  <OptionTile key={key} selected={answers.theme === key} onClick={() => update({ theme: key })} label={p.label} className="items-stretch text-left">
                    <span
                      className="h-10 w-full rounded-[var(--radius-sm)] flex items-center gap-1.5 px-2"
                      style={{ background: pal.paper, border: `1px solid ${pal.line}` }}
                    >
                      <span className="w-4 h-4 rounded-pill shrink-0" style={{ background: answers.brandColor || p.defaultAccent }} />
                      <span className="flex-1 h-2 rounded-pill" style={{ background: pal.surface }} />
                    </span>
                  </OptionTile>
                );
              })}
            </div>
          </div>

          <div>
            <FieldLabel>Base</FieldLabel>
            <SegmentedControl
              className="max-w-[220px]"
              value={answers.themeMode}
              onChange={(themeMode) => update({ themeMode })}
              options={[
                { value: "light" as const, label: "Light" },
                { value: "dark" as const, label: "Dark" },
              ]}
            />
          </div>

          <div>
            <FieldLabel>Font</FieldLabel>
            <div role="radiogroup" className="grid grid-cols-3 gap-2">
              {FONT_KEYS.map((key) => {
                const f = FONT_THEMES[key];
                return (
                  <OptionTile key={key} selected={answers.fontTheme === key} onClick={() => update({ fontTheme: key })} label={f.label}>
                    {/* leading-none pins the sample to its own line box
                        regardless of the face's own line-height metrics. */}
                    <span className="block text-2xl font-semibold leading-none text-ink" style={{ fontFamily: f.display }}>
                      Ag
                    </span>
                  </OptionTile>
                );
              })}
            </div>
          </div>

          <div>
            <FieldLabel>Corner style</FieldLabel>
            <CornerStylePicker value={answers.cornerStyle as CornerKey} onChange={(cornerStyle) => update({ cornerStyle })} />
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
            logoUrl={logo.preview}
            cardStyle={defaultCardStyle(answers.menuLayout)}
            phoneFrame
          />
        </div>
      </div>
    </StepFrame>
  );
}

// Compress → upload → hold the URL in the draft. Shows the picked file
// instantly (object URL) while the upload runs, swaps to the stored URL on
// success, and rolls back on failure. Logo and cover share this; they only
// differ in target size/quality.
function useOnboardingImage(
  kind: "logo" | "cover",
  current: string | null,
  onUploaded: (url: string | null) => void,
) {
  const [uploading, setUploading] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    setLocal(objectUrl);
    setUploading(true);
    try {
      const blob =
        kind === "logo" ? await compressImage(file, 400, 0.9) : await compressImage(file, 1600, 0.85);
      const fd = new FormData();
      fd.append("file", blob, `${kind}.jpg`);
      const res = await uploadOnboardingImage(fd, kind);
      if ("error" in res) {
        setError(res.error);
      } else {
        onUploaded(res.url);
      }
    } catch {
      setError("Couldn't process that image.");
    } finally {
      setUploading(false);
      setLocal(null);
      URL.revokeObjectURL(objectUrl);
    }
  }

  return { uploading, error, onPick, preview: local ?? current };
}

function FinishScreen({
  checklist,
  restaurantName,
  brandColor,
  onDone,
}: {
  checklist: ChecklistItem[];
  restaurantName: string;
  brandColor: string;
  onDone: () => void;
}) {
  const reduced = useReducedMotion();
  const remaining = checklist.filter((c) => !c.done);

  // One celebration for the one moment it's earned. celebrate() itself is
  // reduced-motion-safe and lazy-loads the confetti bundle.
  useEffect(() => {
    celebrate(brandColor ? [brandColor, "#ffffff"] : []);
  }, [brandColor]);

  return (
    <main className="min-h-dvh bg-paper flex items-center justify-center px-5 py-10">
      <motion.div
        variants={stagger(0.07, 0.05)}
        initial={reduced ? false : "hidden"}
        animate="show"
        className="w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <motion.div
            initial={reduced ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={SPRING}
            className="relative w-16 h-16 rounded-pill bg-accent-gradient text-on-accent shadow-accent flex items-center justify-center mx-auto mb-4"
          >
            <span aria-hidden className="absolute inset-0 rounded-pill bg-pine/40 animate-pulse-ring" />
            <svg viewBox="0 0 20 20" className="relative w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <motion.path d="M4 10.5l3.5 3.5L16 6" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.15 }} />
            </svg>
          </motion.div>
          <motion.h1 variants={fadeUp} className="font-display text-display-sm font-semibold">
            {restaurantName || "Your venue"} is ready
          </motion.h1>
          <motion.p variants={fadeUp} className="text-muted text-sm mt-1">
            Here&apos;s what&apos;s left before you open the doors.
          </motion.p>
        </div>

        <motion.ul variants={fadeUp} className="rounded-[var(--radius-card)] border border-line bg-surface shadow-rest divide-y divide-line mb-6">
          {checklist.map((item) => (
            <motion.li key={item.id} variants={fadeUp} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`shrink-0 w-5 h-5 rounded-pill border-2 flex items-center justify-center ${
                  item.done ? "bg-pine border-pine text-on-accent" : "border-line-strong"
                }`}
              >
                {item.done && (
                  <svg viewBox="0 0 20 20" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 10.5l3.5 3.5L16 6" />
                  </svg>
                )}
              </span>
              {item.href && !item.done ? (
                <Link href={item.href} className="text-sm text-ink hover:text-pine flex-1">
                  {item.label}
                </Link>
              ) : (
                <span className={`text-sm flex-1 ${item.done ? "text-muted" : "text-ink"}`}>{item.label}</span>
              )}
            </motion.li>
          ))}
        </motion.ul>

        <motion.div variants={fadeUp}>
          <Button size="lg" full onClick={onDone}>
            {remaining.length > 0 ? "Go to dashboard" : "Take me to the dashboard"}
          </Button>
        </motion.div>
      </motion.div>
    </main>
  );
}
