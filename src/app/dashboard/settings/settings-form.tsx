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
import { CURRENCIES, TIMEZONES } from "./constants";
import { compressImage } from "@/lib/compress-image";
import {
  THEME_PRESETS,
  FONT_THEMES,
  themeVars,
  type ThemeKey,
  type FontKey,
} from "@/lib/theme";
import {
  DAY_NAMES,
  defaultHours,
  parseHours,
  type DayHours,
} from "@/lib/hours";
import { OwnerVerify } from "./owner-verify";

const SWATCHES = [
  "#0f5c42", // pine
  "#a1552f", // terracotta
  "#1d4ed8", // blue
  "#b91c1c", // red
  "#7c3aed", // violet
  "#c2410c", // orange
  "#0d9488", // teal
  "#be185d", // pink
  "#e11d48", // rose
  "#15181b", // near-black
];

const THEME_KEYS = Object.keys(THEME_PRESETS) as ThemeKey[];
const FONT_KEYS = Object.keys(FONT_THEMES) as FontKey[];

export function SettingsForm({
  initial,
}: {
  initial: {
    name: string;
    abn: string | null;
    timezone: string;
    currency: string;
    brandColor: string | null;
    theme: string;
    themeMode: string;
    fontTheme: string;
    logoUrl: string | null;
    coverUrl: string | null;
    bgImageUrl: string | null;
    tipEnabled: boolean;
    tipPresets: number[];
    customerOrdering: boolean;
    customerPayment: boolean;
    staffApproval: boolean;
    paymentTiming: string;
    takeawayEnabled: boolean;
    hours: unknown;
    slug: string;
    ownerPhone: string | null;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [abn, setAbn] = useState(initial.abn ?? "");
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
  const [takeawayEnabled, setTakeawayEnabled] = useState(initial.takeawayEnabled);
  const [hours, setHours] = useState<DayHours[]>(
    parseHours(initial.hours) ?? defaultHours(),
  );

  function setDay(day: number, patch: Partial<DayHours>) {
    setHours((hs) => hs.map((h) => (h.day === day ? { ...h, ...patch } : h)));
  }
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    start(async () => {
      const res = await updateSettings({
        name,
        abn,
        timezone,
        currency,
        brandColor,
        theme,
        themeMode,
        fontTheme,
        tipEnabled,
        tipPresets,
        customerOrdering,
        customerPayment,
        staffApproval,
        paymentTiming,
        takeawayEnabled,
        hours,
      });
      if (res.error) setError(res.error);
      else {
        setMsg("Saved.");
        router.refresh();
      }
    });
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoBusy(true);
    setError(null);
    try {
      const blob = await compressImage(file, 400, 0.9);
      const fd = new FormData();
      fd.append("file", blob, "logo.jpg");
      const res = await uploadLogo(fd);
      if (res.error) setError(res.error);
      else router.refresh();
    } catch {
      setError("Couldn't process that image.");
    } finally {
      setLogoBusy(false);
    }
  }

  async function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverBusy(true);
    setError(null);
    try {
      const blob = await compressImage(file, 1600, 0.85);
      const fd = new FormData();
      fd.append("file", blob, "cover.jpg");
      const res = await uploadCover(fd);
      if (res.error) setError(res.error);
      else router.refresh();
    } catch {
      setError("Couldn't process that image.");
    } finally {
      setCoverBusy(false);
    }
  }

  async function onBackground(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBgBusy(true);
    setError(null);
    try {
      const blob = await compressImage(file, 1600, 0.8);
      const fd = new FormData();
      fd.append("file", blob, "bg.jpg");
      const res = await uploadBackground(fd);
      if (res.error) setError(res.error);
      else router.refresh();
    } catch {
      setError("Couldn't process that image.");
    } finally {
      setBgBusy(false);
    }
  }

  const field =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 focus:border-pine focus:outline-none";

  const previewStyle = themeVars({ theme, themeMode, fontTheme, brandColor });

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Venue */}
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
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted block mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={field}
            >
              {TIMEZONES.map((tz) => (
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

      {/* Owner verification */}
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Owner verification
        </h2>
        <p className="text-sm text-muted">
          Verify a mobile so we know a real person runs this venue. We&apos;ll
          text a one-time code.
        </p>
        <OwnerVerify initialPhone={initial.ownerPhone} />
      </section>

      {/* Appearance */}
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-6">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Appearance
          </h2>
          <p className="text-sm text-muted mt-1">
            How your ordering page looks when a customer scans a table. Changes
            preview live below; press Save to publish.
          </p>
        </div>

        {/* Theme presets */}
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

        {/* Light / dark */}
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

        {/* Accent colour */}
        <div>
          <label className="text-sm text-muted block mb-2">Accent colour</label>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((c) => (
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

        {/* Font pairing */}
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
                  className={`rounded-xl border-2 p-3 transition-colors ${
                    active ? "border-pine" : "border-line hover:border-ink/20"
                  }`}
                >
                  <span
                    className="block text-lg font-semibold"
                    style={{ fontFamily: f.display }}
                  >
                    Ag
                  </span>
                  <span className="block text-xs text-muted mt-1">{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live preview */}
        <div>
          <label className="text-sm text-muted block mb-2">Preview</label>
          <div
            style={previewStyle}
            className="relative rounded-2xl border border-line overflow-hidden"
          >
            {initial.bgImageUrl && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={initial.bgImageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      themeMode === "dark"
                        ? "rgba(8,8,10,0.75)"
                        : "rgba(255,255,255,0.72)",
                  }}
                />
              </>
            )}
            <div className="relative p-5 bg-paper/0">
              <div className="text-center mb-4">
                {initial.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={initial.logoUrl}
                    alt=""
                    className="h-8 w-auto mx-auto mb-1 object-contain"
                  />
                ) : null}
                <p
                  className="font-display text-lg font-semibold text-ink"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {name || "Your café"}
                </p>
                <p className="text-xs text-muted">Table 4</p>
              </div>
              <div className="rounded-xl bg-surface border border-line p-3 mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">Flat White</p>
                  <p className="text-xs text-muted">Silky double shot</p>
                </div>
                <span className="text-xs rounded-lg bg-ink text-surface px-3 py-1.5">
                  Add
                </span>
              </div>
              <button
                type="button"
                className="w-full rounded-xl bg-pine text-[color:var(--on-accent,#fff)] py-2.5 text-sm font-medium"
              >
                Review order · 2
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Logo, banner, background */}
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-5">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Images
        </h2>

        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-lg border border-line bg-paper overflow-hidden flex items-center justify-center shrink-0">
            {initial.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={initial.logoUrl}
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
              {logoBusy ? "Uploading…" : initial.logoUrl ? "Replace logo" : "Upload logo"}
            </button>
            {initial.logoUrl && (
              <button
                onClick={() => start(async () => { await removeLogo(); router.refresh(); })}
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
            {initial.coverUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={initial.coverUrl} alt="" className="w-full h-full object-cover" />
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
              {coverBusy ? "Uploading…" : initial.coverUrl ? "Replace banner" : "Upload banner"}
            </button>
            {initial.coverUrl && (
              <button
                onClick={() => start(async () => { await removeCover(); router.refresh(); })}
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
            {initial.bgImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={initial.bgImageUrl} alt="" className="w-full h-full object-cover" />
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
              {bgBusy ? "Uploading…" : initial.bgImageUrl ? "Replace background" : "Upload background"}
            </button>
            {initial.bgImageUrl && (
              <button
                onClick={() => start(async () => { await removeBackground(); router.refresh(); })}
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

      {/* Service model */}
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

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={takeawayEnabled}
            onChange={(e) => setTakeawayEnabled(e.target.checked)}
            className="accent-pine w-4 h-4 mt-0.5"
          />
          <span>
            <span className="font-medium">Accept pickup / takeaway orders</span>
            <span className="block text-muted text-xs">
              Guests order for pickup at{" "}
              <code className="bg-paper rounded px-1">/to/{initial.slug}</code> —
              each order gets its own pickup number.
            </span>
          </span>
        </label>
      </section>

      {/* Opening hours */}
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Opening hours
        </h2>
        <p className="text-sm text-muted">
          Customers can browse the menu anytime, but ordering is only open during
          these hours (venue local time).
        </p>
        <div className="space-y-1.5">
          {hours.map((h) => (
            <div key={h.day} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0">{DAY_NAMES[h.day]}</span>
              <label className="flex items-center gap-1.5 text-muted">
                <input
                  type="checkbox"
                  checked={h.closed}
                  onChange={(e) => setDay(h.day, { closed: e.target.checked })}
                  className="accent-pine w-3.5 h-3.5"
                />
                Closed
              </label>
              {!h.closed && (
                <>
                  <input
                    type="time"
                    value={h.open}
                    onChange={(e) => setDay(h.day, { open: e.target.value })}
                    className="rounded-md border border-line bg-surface px-2 py-1 text-sm focus:border-pine focus:outline-none"
                  />
                  <span className="text-muted">–</span>
                  <input
                    type="time"
                    value={h.close}
                    onChange={(e) => setDay(h.day, { close: e.target.value })}
                    className="rounded-md border border-line bg-surface px-2 py-1 text-sm focus:border-pine focus:outline-none"
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Tipping */}
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

      {error && <p className="text-sm text-danger">{error}</p>}
      {msg && <p className="text-sm text-pine-deep">{msg}</p>}

      <div className="sticky bottom-4">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-xl bg-pine text-[color:var(--on-accent,#fff)] px-6 py-3 font-medium hover:bg-pine-deep disabled:opacity-60 shadow-sm"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
