"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  updateSettings,
  uploadLogo,
  removeLogo,
  uploadCover,
  removeCover,
  uploadBackground,
  removeBackground,
} from "./actions";
import { CURRENCIES } from "./constants";
import { COUNTRIES, timezonesForCountry, currencyForCountry, hasTaxRules } from "@/lib/countries";
import { LANGUAGES } from "@/lib/languages";
import { compressImage } from "@/lib/compress-image";
import {
  THEME_PRESETS,
  FONT_THEMES,
  ACCENT_SWATCHES,
  type ThemeKey,
  type FontKey,
  type CornerKey,
} from "@/lib/theme";
import { defaultHours, parseHours, type DayHours } from "@/lib/hours";
import {
  MENU_LAYOUTS,
  BG_PATTERNS,
  defaultCardStyle,
  type MenuLayout,
  type CardStyle,
} from "@/lib/menu-style";
import { AbnVerify } from "./abn-verify";
import { HoursEditor } from "@/components/venue-setup/hours-editor";
import { CustomerPreview } from "@/components/venue-setup/customer-preview";
import { CornerStylePicker } from "@/components/venue-setup/corner-style-picker";
import { NotificationsPicker } from "@/components/venue-setup/notifications-picker";
import { CustomisationPicker } from "@/components/venue-setup/customisation-picker";

const THEME_KEYS = Object.keys(THEME_PRESETS) as ThemeKey[];
const FONT_KEYS = Object.keys(FONT_THEMES) as FontKey[];

// Renders only ONE section's controls at a time (the settings hub restructure
// — see /dashboard/settings/page.tsx) while keeping every field's state and
// the single shared save() call completely unchanged: a sub-page still shows
// only its own area, but saving it still submits the full current settings
// payload through the exact same updateSettings action as before. This is
// deliberately a navigation split, not a rewrite of the save flow.
export type SettingsSection = "venue" | "branding" | "service" | "hours" | "notifications";

export function SettingsForm({
  initial,
  section,
}: {
  section: SettingsSection;
  initial: {
    name: string;
    country: string;
    language: string;
    abn: string | null;
    timezone: string;
    currency: string;
    brandColor: string | null;
    theme: string;
    themeMode: string;
    fontTheme: string;
    cornerStyle: string;
    tagline: string | null;
    menuLayout: string;
    cardStyle: unknown;
    typeScale: string;
    sectionHeaderStyle: string;
    buttonShape: string;
    buttonFill: string;
    bgTreatment: string;
    bgPatternKey: string | null;
    bgOverlayStrength: number;
    qrForegroundColor: string | null;
    qrBackgroundColor: string | null;
    qrCornerStyle: string;
    qrEmbedLogo: boolean;
    qrCardTemplate: string;
    instagramHandle: string | null;
    websiteUrl: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    bgImageUrl: string | null;
    tipEnabled: boolean;
    tipPresets: number[];
    customerOrdering: boolean;
    customerPayment: boolean;
    staffApproval: boolean;
    paymentTiming: string;
    requirePaymentBeforeOrder: boolean;
    kitchenChime: boolean;
    orderReadySmsEnabled: boolean;
    surchargeEnabled: boolean;
    surchargeBasisPoints: number;
    hours: unknown;
    slug: string;
    ownerPhone: string | null;
    abnVerifiedAt: string | null;
    abnVerifiedValue: string | null;
    abnVerifiedName: string | null;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [country, setCountry] = useState(initial.country);
  const [language, setLanguage] = useState(initial.language);
  const [abn, setAbn] = useState(initial.abn ?? "");
  const [ownerPhone, setOwnerPhone] = useState(initial.ownerPhone ?? "");
  const [timezone, setTimezone] = useState(initial.timezone);
  const [currency, setCurrency] = useState(initial.currency);
  const [brandColor, setBrandColor] = useState(initial.brandColor ?? "#0f5c42");
  const [theme, setTheme] = useState<ThemeKey>(
    (initial.theme as ThemeKey) ?? "warm",
  );
  const [themeMode, setThemeMode] = useState(initial.themeMode ?? "light");
  const [fontTheme, setFontTheme] = useState<FontKey>(
    (initial.fontTheme as FontKey) ?? "classic",
  );
  const [cornerStyle, setCornerStyle] = useState<CornerKey>(
    (initial.cornerStyle as CornerKey) ?? "soft",
  );
  const [tagline, setTagline] = useState(initial.tagline ?? "");
  const [menuLayout, setMenuLayout] = useState<MenuLayout>(
    (initial.menuLayout as MenuLayout) ?? "list",
  );
  const [cardStyle, setCardStyle] = useState<CardStyle>(() => {
    const o = initial.cardStyle;
    return o && typeof o === "object" ? { ...defaultCardStyle(menuLayout), ...(o as object) } : defaultCardStyle(menuLayout);
  });
  const [typeScale, setTypeScale] = useState(initial.typeScale || "comfortable");
  const [sectionHeaderStyle, setSectionHeaderStyle] = useState(initial.sectionHeaderStyle || "plain");
  const [buttonShape, setButtonShape] = useState(initial.buttonShape || "rounded");
  const [buttonFill, setButtonFill] = useState(initial.buttonFill || "solid");
  const [bgTreatment, setBgTreatment] = useState(initial.bgTreatment || "solid");
  const [bgPatternKey, setBgPatternKey] = useState(initial.bgPatternKey ?? "dots");
  const [bgOverlayStrength, setBgOverlayStrength] = useState(initial.bgOverlayStrength ?? 55);
  const [qrForegroundColor, setQrForegroundColor] = useState(initial.qrForegroundColor ?? "");
  const [qrBackgroundColor, setQrBackgroundColor] = useState(initial.qrBackgroundColor ?? "");
  const [qrCornerStyle, setQrCornerStyle] = useState(initial.qrCornerStyle || "square");
  const [qrEmbedLogo, setQrEmbedLogo] = useState(initial.qrEmbedLogo ?? false);
  const [qrCardTemplate, setQrCardTemplate] = useState(initial.qrCardTemplate || "branded");
  const [instagramHandle, setInstagramHandle] = useState(initial.instagramHandle ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initial.websiteUrl ?? "");
  const [kitchenChime, setKitchenChime] = useState(initial.kitchenChime);
  const [orderReadySmsEnabled, setOrderReadySmsEnabled] = useState(
    initial.orderReadySmsEnabled,
  );
  const [tipEnabled, setTipEnabled] = useState(initial.tipEnabled);
  const [tipPresetsStr, setTipPresetsStr] = useState(
    initial.tipPresets.join(", "),
  );
  const [customerOrdering, setCustomerOrdering] = useState(
    initial.customerOrdering,
  );
  const [customerPayment, setCustomerPayment] = useState(
    initial.customerPayment,
  );
  const [staffApproval, setStaffApproval] = useState(initial.staffApproval);
  const [paymentTiming, setPaymentTiming] = useState(
    initial.paymentTiming ?? "after",
  );
  const [requirePaymentBeforeOrder, setRequirePaymentBeforeOrder] = useState(
    initial.requirePaymentBeforeOrder,
  );
  const [surchargeEnabled, setSurchargeEnabled] = useState(initial.surchargeEnabled);
  const [surchargePercentStr, setSurchargePercentStr] = useState(
    (initial.surchargeBasisPoints / 100).toString(),
  );
  const [hours, setHours] = useState<DayHours[]>(
    parseHours(initial.hours) ?? defaultHours(),
  );
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Held in state (not read straight from `initial`) so a successful upload
  // shows up immediately without waiting on a full page refresh, and an
  // instant local preview can show the moment a file is picked.
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl);
  const [bgImageUrl, setBgImageUrl] = useState(initial.bgImageUrl);

  const logoRef = useRef<HTMLInputElement>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const bgRef = useRef<HTMLInputElement>(null);
  const [bgBusy, setBgBusy] = useState(false);

  function save() {
    setError(null);
    setMsg(null);
    const tipPresets = tipPresetsStr
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 100);
    const surchargePercentNum = Math.min(5, Math.max(0, parseFloat(surchargePercentStr) || 0));
    start(async () => {
      const res = await updateSettings({
        name,
        country,
        language,
        abn,
        ownerPhone,
        timezone,
        currency,
        brandColor,
        theme,
        themeMode,
        fontTheme,
        cornerStyle,
        tagline,
        menuLayout,
        cardStyle,
        typeScale,
        sectionHeaderStyle,
        buttonShape,
        buttonFill,
        bgTreatment,
        bgPatternKey,
        bgOverlayStrength,
        qrForegroundColor,
        qrBackgroundColor,
        qrCornerStyle,
        qrEmbedLogo,
        qrCardTemplate,
        instagramHandle,
        websiteUrl,
        tipEnabled,
        tipPresets,
        customerOrdering,
        customerPayment,
        staffApproval,
        paymentTiming,
        requirePaymentBeforeOrder,
        kitchenChime,
        orderReadySmsEnabled,
        surchargeEnabled,
        surchargePercent: surchargePercentNum,
        hours,
      });
      if (res.error) setError(res.error);
      else {
        setMsg("Saved.");
        router.refresh();
      }
    });
  }

  // Shared shape for the three image uploads: show an instant local preview
  // (URL.createObjectURL) the moment a file is picked, swap it for the real
  // stored URL on success, and roll back to whatever was there before on
  // failure — previously the preview didn't update until a full refresh.
  async function handleImageUpload(
    file: File,
    opts: {
      maxDim: number;
      quality: number;
      filename: string;
      current: string | null;
      setCurrent: (url: string | null) => void;
      setBusy: (busy: boolean) => void;
      upload: (fd: FormData) => Promise<{ error?: string; url?: string }>;
    },
  ) {
    const { maxDim, quality, filename, current, setCurrent, setBusy, upload } = opts;
    const objectUrl = URL.createObjectURL(file);
    const previous = current;
    setCurrent(objectUrl);
    setBusy(true);
    setError(null);
    try {
      const blob = await compressImage(file, maxDim, quality);
      const fd = new FormData();
      fd.append("file", blob, filename);
      const res = await upload(fd);
      if (res.error) {
        setError(res.error);
        setCurrent(previous);
      } else if (res.url) {
        setCurrent(res.url);
      }
    } catch {
      setError("Couldn't process that image.");
      setCurrent(previous);
    } finally {
      setBusy(false);
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await handleImageUpload(file, {
      maxDim: 400,
      quality: 0.9,
      filename: "logo.jpg",
      current: logoUrl,
      setCurrent: setLogoUrl,
      setBusy: setLogoBusy,
      upload: uploadLogo,
    });
  }

  async function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await handleImageUpload(file, {
      maxDim: 1600,
      quality: 0.85,
      filename: "cover.jpg",
      current: coverUrl,
      setCurrent: setCoverUrl,
      setBusy: setCoverBusy,
      upload: uploadCover,
    });
  }

  async function onBackground(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await handleImageUpload(file, {
      maxDim: 1600,
      quality: 0.8,
      filename: "bg.jpg",
      current: bgImageUrl,
      setCurrent: setBgImageUrl,
      setBusy: setBgBusy,
      upload: uploadBackground,
    });
  }

  const field =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 focus:border-pine focus:outline-none";

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Venue */}
      {section === "venue" && (
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">Venue</h2>
        <div>
          <label className="text-sm text-muted block mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted block mb-1">Country</label>
            <select
              value={country}
              onChange={(e) => {
                const next = e.target.value;
                const zones = timezonesForCountry(next);
                setCountry(next);
                setCurrency(currencyForCountry(next));
                if (!zones.includes(timezone)) setTimezone(zones[0]);
              }}
              className={field}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-muted block mb-1">Menu language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={field}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {hasTaxRules(country) ? (
          <div>
            <label className="text-sm text-muted block mb-1">
              ABN <span className="text-xs">(shown on tax invoices)</span>
            </label>
            <input
              value={abn}
              onChange={(e) => setAbn(e.target.value)}
              placeholder="11 digits"
              inputMode="numeric"
              className={field}
            />
            <div className="mt-2">
              <AbnVerify
                abn={abn}
                verifiedAt={initial.abnVerifiedAt}
                verifiedName={initial.abnVerifiedName}
                verifiedAbn={initial.abnVerifiedValue}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted rounded-lg border border-line bg-paper px-3.5 py-3">
            We don&apos;t have tax rules for your country wired up yet.
          </p>
        )}
        <div>
          <label className="text-sm text-muted block mb-1">
            Contact phone <span className="text-xs">(optional — not shown to customers)</span>
          </label>
          <input
            inputMode="tel"
            value={ownerPhone}
            onChange={(e) => setOwnerPhone(e.target.value)}
            placeholder="04xx xxx xxx"
            className={field}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted block mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={field}
            >
              {timezonesForCountry(country).map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-muted block mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={field}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>
      )}

      {/* Appearance */}
      {section === "branding" && (
      <>
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Appearance
        </h2>
        <p className="text-sm text-muted mt-1">
          How your ordering page looks when a customer scans a table. Changes
          preview live on the right; press Save to publish.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {/* Theme & colour */}
          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-5">
            <h3 className="text-sm font-semibold">Theme &amp; colour</h3>

            <div>
              <label className="text-sm text-muted block mb-2">Theme</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                        className="h-10 rounded-lg mb-2 flex items-center gap-1 px-2"
                        style={{ background: pal.paper, border: `1px solid ${pal.line}` }}
                      >
                        <span
                          className="w-4 h-4 rounded-full"
                          style={{ background: brandColor || p.defaultAccent }}
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
            </div>

            <div>
              <label className="text-sm text-muted block mb-2">Base</label>
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
            </div>

            <div>
              <label className="text-sm text-muted block mb-2">Accent colour</label>
              <div className="flex flex-wrap items-center gap-2">
                {ACCENT_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBrandColor(c)}
                    aria-label={`Accent ${c}`}
                    className={`w-9 h-9 rounded-full border-2 ${
                      brandColor.toLowerCase() === c.toLowerCase()
                        ? "border-ink"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <label className="flex items-center gap-2 ml-1 text-sm text-muted cursor-pointer">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#0f5c42"}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-9 h-9 rounded-full border border-line bg-transparent cursor-pointer p-0"
                    aria-label="Custom accent colour"
                  />
                  Custom
                </label>
              </div>
            </div>
          </section>

          {/* Typography & shape */}
          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-5">
            <h3 className="text-sm font-semibold">Typography &amp; shape</h3>

            <div>
              <label className="text-sm text-muted block mb-2">Font</label>
              <div className="grid grid-cols-3 gap-2">
                {FONT_KEYS.map((key) => {
                  const f = FONT_THEMES[key];
                  const active = fontTheme === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setFontTheme(key)}
                      className={`rounded-xl border-2 p-3 min-w-0 overflow-hidden transition-colors ${
                        active ? "border-pine" : "border-line hover:border-ink/20"
                      }`}
                    >
                      {/* leading-none pins this to its own line box regardless
                          of the chosen display font's own line-height metrics
                          — some (e.g. Fraunces) default to a much taller one
                          than the sans labels below, which without this could
                          overlap. */}
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
              <CornerStylePicker value={cornerStyle} onChange={setCornerStyle} />
            </div>
          </section>

          {/* Menu layout & style */}
          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-5">
            <h3 className="text-sm font-semibold">Menu layout &amp; style</h3>

            <div>
              <label className="text-sm text-muted block mb-2">Menu layout</label>
              <div className="grid grid-cols-2 gap-2">
                {MENU_LAYOUTS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setMenuLayout(l.value)}
                    className={`text-left rounded-xl border-2 p-3 transition-colors ${
                      menuLayout === l.value
                        ? "border-pine bg-pine-soft"
                        : "border-line hover:border-ink/20"
                    }`}
                  >
                    <span className="text-sm font-medium block">{l.label}</span>
                    <span className="text-xs text-muted mt-0.5 block">{l.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-line pt-5">
              <CustomisationPicker
                cardStyle={cardStyle}
                onCardStyleChange={setCardStyle}
                typeScale={typeScale}
                onTypeScaleChange={setTypeScale}
                sectionHeaderStyle={sectionHeaderStyle}
                onSectionHeaderStyleChange={setSectionHeaderStyle}
                buttonShape={buttonShape}
                onButtonShapeChange={setButtonShape}
                buttonFill={buttonFill}
                onButtonFillChange={setButtonFill}
                bgTreatment={bgTreatment}
                onBgTreatmentChange={setBgTreatment}
                bgPatternKey={bgPatternKey}
                onBgPatternKeyChange={setBgPatternKey}
                bgOverlayStrength={bgOverlayStrength}
                onBgOverlayStrengthChange={setBgOverlayStrength}
                hasBgImage={!!bgImageUrl}
              />
            </div>
          </section>

          {/* Branding details */}
          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-5">
            <h3 className="text-sm font-semibold">Branding details</h3>

            <div>
              <label className="text-sm text-muted block mb-2">
                Tagline <span className="text-xs">(optional)</span>
              </label>
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Slow coffee, fast Wi-Fi"
                maxLength={80}
                className={field}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted block mb-2">
                  Instagram <span className="text-xs">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">@</span>
                  <input
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                    placeholder="yourvenue"
                    maxLength={30}
                    className={`${field} pl-7`}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted block mb-2">
                  Website <span className="text-xs">(optional)</span>
                </label>
                <input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="yourvenue.com"
                  maxLength={200}
                  className={field}
                />
              </div>
            </div>
            <p className="text-xs text-muted">
              Tagline and social links are shown on your customer ordering page
              so guests can follow or find you.
            </p>
          </section>
        </div>

        {/* Live preview — sticky alongside the editor on wide screens */}
        <div className="lg:sticky lg:top-6">
          <p className="text-sm text-muted mb-2">Preview</p>
          <CustomerPreview
            appearance={{ theme, themeMode, fontTheme, brandColor, cornerStyle }}
            restaurantName={name}
            tagline={tagline}
            logoUrl={logoUrl}
            bgImageUrl={bgImageUrl}
            cardStyle={cardStyle}
            buttonShape={buttonShape}
            buttonFill={buttonFill}
            typeScale={typeScale}
          />
        </div>
      </div>

      {/* Logo, banner, background */}
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-5">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Images
        </h2>

        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-lg border border-line bg-paper overflow-hidden flex items-center justify-center shrink-0">
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logoUrl}
                alt=""
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-[10px] text-muted">Logo</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              onChange={onLogo}
              className="hidden"
            />
            <button
              disabled={logoBusy}
              onClick={() => logoRef.current?.click()}
              className="text-sm rounded-md border border-line px-3 py-1.5 hover:border-ink/30 disabled:opacity-50"
            >
              {logoBusy ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
            </button>
            {logoUrl && (
              <button
                onClick={() => start(async () => { await removeLogo(); setLogoUrl(null); })}
                className="text-sm text-muted hover:text-danger"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Banner */}
        <div>
          <label className="text-sm text-muted block mb-2">
            Banner image{" "}
            <span className="text-xs">(small header strip)</span>
          </label>
          <div className="rounded-lg border border-line bg-paper overflow-hidden h-24 flex items-center justify-center mb-2">
            {coverUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-muted">No banner</span>
            )}
          </div>
          <input ref={coverRef} type="file" accept="image/*" onChange={onCover} className="hidden" />
          <div className="flex items-center gap-2">
            <button
              disabled={coverBusy}
              onClick={() => coverRef.current?.click()}
              className="text-sm rounded-md border border-line px-3 py-1.5 hover:border-ink/30 disabled:opacity-50"
            >
              {coverBusy ? "Uploading…" : coverUrl ? "Replace banner" : "Upload banner"}
            </button>
            {coverUrl && (
              <button
                onClick={() => start(async () => { await removeCover(); setCoverUrl(null); })}
                className="text-sm text-muted hover:text-danger"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Full background */}
        <div>
          <label className="text-sm text-muted block mb-2">
            Page background{" "}
            <span className="text-xs">(full-screen photo behind everything)</span>
          </label>
          <div className="rounded-lg border border-line bg-paper overflow-hidden h-28 flex items-center justify-center mb-2">
            {bgImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={bgImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-muted">No background</span>
            )}
          </div>
          <input ref={bgRef} type="file" accept="image/*" onChange={onBackground} className="hidden" />
          <div className="flex items-center gap-2">
            <button
              disabled={bgBusy}
              onClick={() => bgRef.current?.click()}
              className="text-sm rounded-md border border-line px-3 py-1.5 hover:border-ink/30 disabled:opacity-50"
            >
              {bgBusy ? "Uploading…" : bgImageUrl ? "Replace background" : "Upload background"}
            </button>
            {bgImageUrl && (
              <button
                onClick={() => start(async () => { await removeBackground(); setBgImageUrl(null); })}
                className="text-sm text-muted hover:text-danger"
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-muted mt-2">
            A soft overlay keeps text readable. Best with a calm, low-detail photo.
          </p>
        </div>
      </section>

      </>
      )}

      {/* Service model */}
      {section === "service" && (
      <>
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Service model
        </h2>
        <p className="text-sm text-muted">
          Choose what customers can do from their phone. Turn ordering off for
          table service where waiters take the orders — the phone becomes a menu.
        </p>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={customerOrdering}
            onChange={(e) => setCustomerOrdering(e.target.checked)}
            className="accent-pine w-4 h-4 mt-0.5"
          />
          <span>
            <span className="font-medium">Let customers order from their phone</span>
            <span className="block text-muted text-xs">
              Off = view-only menu; your staff take orders at the table.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={customerPayment}
            onChange={(e) => setCustomerPayment(e.target.checked)}
            className="accent-pine w-4 h-4 mt-0.5"
          />
          <span>
            <span className="font-medium">Let customers pay from their phone</span>
            <span className="block text-muted text-xs">
              Off = they pay at the counter; staff mark the bill paid.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={staffApproval}
            onChange={(e) => setStaffApproval(e.target.checked)}
            className="accent-pine w-4 h-4 mt-0.5"
          />
          <span>
            <span className="font-medium">
              Staff approve orders before the kitchen sees them
            </span>
            <span className="block text-muted text-xs">
              Customer orders wait in an approval queue — a safeguard against
              accidental or prank orders. Off = orders go straight to the kitchen.
            </span>
          </span>
        </label>

        <div>
          <p className="text-sm font-medium mb-1">When do customers pay?</p>
          <div className="inline-flex rounded-lg border border-line p-0.5">
            {(
              [
                ["after", "After — running tab"],
                ["before", "Before — prepay"],
              ] as [string, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setPaymentTiming(v)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  paymentTiming === v
                    ? "bg-pine text-[color:var(--on-accent,#fff)]"
                    : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-muted text-xs mt-1.5">
            Prepay prompts guests to pay as soon as they order, and the kitchen
            ticket shows paid/unpaid so nothing is handed over unpaid.
          </p>
        </div>

        {customerPayment && (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={requirePaymentBeforeOrder}
              onChange={(e) => setRequirePaymentBeforeOrder(e.target.checked)}
              className="accent-pine w-4 h-4 mt-0.5"
            />
            <span>
              <span className="font-medium">
                Require payment before ordering (strict)
              </span>
              <span className="block text-muted text-xs">
                An alternative to the softer &quot;prepay&quot; option above:
                the customer page treats an unpaid order as blocked, not just
                suggested to pay — no skip button, only pay or cancel. Off by
                default.
              </span>
            </span>
          </label>
        )}

        <div>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={surchargeEnabled}
              onChange={(e) => setSurchargeEnabled(e.target.checked)}
              className="accent-pine w-4 h-4 mt-0.5"
            />
            <span>
              <span className="font-medium">Add a card surcharge</span>
              <span className="block text-muted text-xs">
                Off by default. Shown to guests as its own line before they
                confirm payment, and on every tax invoice — never hidden in
                the total.
              </span>
            </span>
          </label>
          {surchargeEnabled && (
            <div className="mt-2 ml-7 flex items-center gap-2">
              <input
                inputMode="decimal"
                value={surchargePercentStr}
                onChange={(e) => setSurchargePercentStr(e.target.value)}
                className="w-20 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm focus:border-pine focus:outline-none"
              />
              <span className="text-sm text-muted">% surcharge, added to every card payment</span>
            </div>
          )}
        </div>
      </section>

      {/* Tipping — part of the Service model page (checkout-adjacent), even
          though it sits here in the file next to Opening hours below. */}
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">Tipping</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={tipEnabled}
            onChange={(e) => setTipEnabled(e.target.checked)}
            className="accent-pine w-4 h-4"
          />
          Offer tipping at checkout
        </label>
        {tipEnabled && (
          <div>
            <label className="text-sm text-muted block mb-1">
              Suggested percentages (comma separated)
            </label>
            <input
              value={tipPresetsStr}
              onChange={(e) => setTipPresetsStr(e.target.value)}
              placeholder="5, 10, 15"
              className={field}
            />
          </div>
        )}
      </section>
      </>
      )}

      {/* Opening hours */}
      {section === "hours" && (
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Opening hours
        </h2>
        <p className="text-sm text-muted">
          Customers can browse the menu anytime, but ordering is only open during
          these hours (venue local time).
        </p>
        <HoursEditor value={hours} onChange={setHours} />
      </section>
      )}

      {/* Notifications */}
      {section === "notifications" && (
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Notifications
        </h2>
        <NotificationsPicker
          kitchenChime={kitchenChime}
          onKitchenChimeChange={setKitchenChime}
        />
      </section>
      )}

      <div className="sticky bottom-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-xl bg-pine text-[color:var(--on-accent,#fff)] px-6 py-3 font-medium hover:bg-pine-deep disabled:opacity-60 shadow-sm"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
        {msg && <p className="text-sm text-pine-deep">{msg}</p>}
      </div>
    </div>
  );
}
