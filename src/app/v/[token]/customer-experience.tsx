"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { addItems, cancelOrder, emailMyReceipt } from "./actions";
import { PaySheet, type Mode as PayMode } from "./pay-sheet";
import { EmailReceiptForm } from "@/components/receipt/email-receipt-form";
import { CallStaff } from "./call-staff";
import { BrandIntro } from "./brand-intro";
import { MenuDisplay } from "./menu-display";
import { MenuOrderer, type OrderCategory } from "@/components/order/menu-orderer";
import { OrderTracker } from "@/components/order/order-tracker";
import { LiveRefresh } from "@/app/dashboard/live-refresh";
import { Button } from "@/components/ui/button";
import { AnimatedMoney } from "@/components/ui/animated-number";
import { celebrate } from "@/components/ui/confetti";
import { fadeUp, pop, stagger, SPRING_PRESS, easeOut, haptic } from "@/components/ui/motion";
import { formatCents } from "@/lib/money";
import { themeVars, resolveAccent, onAccent } from "@/lib/theme";
import { patternBackgroundStyle } from "@/lib/menu-style";

type BillItem = {
  id: string;
  nameSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  paidQuantity: number;
  lineTotalCents: number;
  modifiers: { name: string }[] | null;
};
type Bill = {
  items: BillItem[];
  subtotalCents: number;
  totalCents: number;
  amountPaidCents: number;
} | null;
type OrderStatus = {
  id: string;
  status: string;
  orderNumber: number | null;
  items: string[];
};
type Paid = { amountCents: number; fullyPaid: boolean; remainingAfter: number; totalCents: number };
type Placed = { name: string; quantity: number }[];
type View = "home" | "menu" | "bill";

export function CustomerExperience({
  token,
  restaurantId,
  restaurantName,
  locationName,
  tableLabel,
  currency,
  logoUrl,
  coverUrl,
  bgImageUrl,
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
  instagramHandle,
  websiteUrl,
  paymentTiming,
  requirePaymentBeforeOrder,
  tipEnabled,
  tipPresets,
  surchargeEnabled,
  surchargeBasisPoints,
  showTillzBranding,
  splitMethods,
  squareEnabled,
  squareAppId,
  squareLocationId,
  squareEnv,
  open,
  canOrder,
  canPay,
  orders,
  menu,
  bill,
}: {
  token: string;
  restaurantId: string;
  restaurantName: string;
  locationName: string;
  tableLabel: string;
  currency: string;
  logoUrl: string | null;
  coverUrl: string | null;
  bgImageUrl: string | null;
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
  instagramHandle: string | null;
  websiteUrl: string | null;
  paymentTiming: string;
  requirePaymentBeforeOrder: boolean;
  tipEnabled: boolean;
  tipPresets: number[];
  surchargeEnabled: boolean;
  surchargeBasisPoints: number;
  showTillzBranding: boolean;
  splitMethods: string[];
  squareEnabled: boolean;
  squareAppId: string | null;
  squareLocationId: string | null;
  squareEnv: string | null;
  open: boolean;
  canOrder: boolean;
  canPay: boolean;
  orders: OrderStatus[];
  menu: OrderCategory[];
  bill: Bill;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("home");
  const [paid, setPaid] = useState<Paid | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const allowedModes = (["full", "equal", "items", "custom"] as PayMode[]).filter((m) =>
    splitMethods.includes(m),
  );
  const [payMode, setPayMode] = useState<PayMode>(
    allowedModes.includes("full") ? "full" : allowedModes[0] ?? "full",
  );
  const [cancelling, startCancel] = useTransition();

  function onCancel(orderId: string) {
    startCancel(async () => {
      await cancelOrder(token, orderId);
      router.refresh();
    });
  }

  const remaining = bill ? bill.totalCents - bill.amountPaidCents : 0;
  const dark = themeMode === "dark";
  const themeStyle = themeVars({ theme, themeMode, fontTheme, brandColor, cornerStyle });
  const accent = resolveAccent({ theme, brandColor });

  // Send the order, then hand a summary to the success screen. We deliberately
  // do NOT await router.refresh() before showing success — the confirmation is
  // driven by local state, so the screen appears instantly and the server data
  // re-syncs in the background for when they open their bill.
  async function submitOrder(
    lines: { menuItemId: string; quantity: number; optionIds: string[]; note?: string }[],
    note?: string,
    clientRequestId?: string,
  ) {
    const res = await addItems(token, lines, note || undefined, clientRequestId);
    return res;
  }

  function handlePlaced(summary: Placed) {
    setPlaced(summary);
    haptic([12, 30, 12]);
    router.refresh();
  }

  // Background layer: "photo" (an uploaded image, scrim strength now the
  // venue's own choice instead of a fixed value — a busy photo needs more
  // cover than a calm one), "pattern" (a small built-in tint, no upload
  // needed), or "solid" (today's plain default). Falls back to solid if
  // "photo" is selected but nothing's actually been uploaded.
  const usePhoto = bgTreatment === "photo" && !!bgImageUrl;
  const usePattern = bgTreatment === "pattern";
  const overlay = Math.min(100, Math.max(0, bgOverlayStrength)) / 100;
  const inkHex = (themeStyle as Record<string, string>)["--color-ink"] || "#15181b";

  const Background = usePhoto ? (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bgImageUrl!}
        alt=""
        aria-hidden
        className="fixed inset-0 w-full h-full object-cover -z-20"
        loading="eager"
      />
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          background: dark
            ? `rgba(8,8,10,${overlay})`
            : `rgba(255,255,255,${overlay})`,
        }}
      />
    </>
  ) : usePattern ? (
    <div aria-hidden className="fixed inset-0 -z-20" style={patternBackgroundStyle(bgPatternKey, inkHex)} />
  ) : null;

  function Shell({ children, live = true }: { children: React.ReactNode; live?: boolean }) {
    return (
      <main
        style={themeStyle}
        className={`relative min-h-dvh text-ink ${usePhoto ? "" : "bg-paper"}`}
      >
        {live && <LiveRefresh restaurantId={restaurantId} seconds={20} />}
        {Background}
        {children}
      </main>
    );
  }

  const latestOrder = orders.length > 0 ? orders[orders.length - 1] : null;

  // ---- Order placed (success) ----
  if (placed) {
    const totalItems = placed.reduce((n, l) => n + l.quantity, 0);
    // A strict venue never tells the customer this reached the kitchen until
    // it's actually paid for — it's on hold either way (see addItemsForTable's
    // awaitingPayment gate), but this mode says so plainly instead of the
    // softer "sent, pay whenever" framing paymentTiming "before" alone uses.
    const strictHold = requirePaymentBeforeOrder && canPay && remaining > 0;
    return (
      <Shell>
        <motion.div
          variants={stagger(0.08)}
          initial="hidden"
          animate="show"
          className="max-w-sm mx-auto px-5 pt-10 pb-10 min-h-dvh flex flex-col justify-center"
        >
          <motion.div
            variants={pop}
            className={`w-20 h-20 rounded-pill flex items-center justify-center mx-auto ${
              strictHold ? "bg-warn-soft text-warn" : "bg-pine text-on-accent shadow-accent"
            }`}
          >
            {strictHold ? (
              <svg viewBox="0 0 24 24" className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <motion.path d="M5 12.5l4.5 4.5L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }} />
              </svg>
            )}
          </motion.div>
          <motion.h1 variants={fadeUp} className="font-display text-display-sm font-semibold text-center mt-5">
            {strictHold ? "Payment required" : "Order sent to the kitchen"}
          </motion.h1>
          <motion.p variants={fadeUp} className="text-muted mt-1.5 text-sm text-center">
            {strictHold
              ? `Pay now to send this — ${totalItems} ${totalItems === 1 ? "item" : "items"}.`
              : `${totalItems} ${totalItems === 1 ? "item" : "items"} for table ${tableLabel}.`}
          </motion.p>

          {!strictHold && (
            <motion.div variants={fadeUp} className="mt-6 rounded-[var(--radius-card)] bg-surface shadow-raised px-5 pt-4 pb-5">
              <OrderTracker status={latestOrder?.status ?? "SUBMITTED"} />
            </motion.div>
          )}

          <motion.ul variants={fadeUp} className="mt-5 rounded-[var(--radius-card)] bg-surface border border-line divide-y divide-line">
            {placed.map((l, i) => (
              <li key={i} className="flex justify-between text-sm px-4 py-2.5">
                <span className="text-ink-soft">{l.name}</span>
                <span className="text-muted tabular">×{l.quantity}</span>
              </li>
            ))}
          </motion.ul>

          <motion.p variants={fadeUp} className="text-xs text-muted mt-4 text-center">
            {strictHold
              ? "The kitchen won't see this order until it's paid. Changed your mind? Cancel it under “Your orders” instead."
              : "Ordered by mistake? Cancel it under “Your orders” until the kitchen starts preparing it."}
          </motion.p>

          <motion.div variants={fadeUp} className="mt-6 space-y-2.5">
            {(paymentTiming === "before" || strictHold) && canPay && remaining > 0 ? (
              <Button
                variant="primary"
                size="lg"
                full
                onClick={() => {
                  setPlaced(null);
                  setView("bill");
                  setPayMode("full");
                  setPayOpen(true);
                }}
                className="justify-between"
              >
                <span>Pay now</span>
                <AnimatedMoney cents={remaining} currency={currency} className="font-display text-lg" />
              </Button>
            ) : (
              <Button
                variant="ink"
                size="lg"
                full
                onClick={() => {
                  setPlaced(null);
                  setView("bill");
                }}
              >
                View my bill
              </Button>
            )}
            {/* Strict mode drops "Order more" — browsing back to the menu
                while an unpaid, held order sits there reads as exactly the
                skip path this mode exists to remove. */}
            {!strictHold && (
              <Button
                variant="secondary"
                size="lg"
                full
                onClick={() => {
                  setPlaced(null);
                  setView("menu");
                }}
              >
                Order more
              </Button>
            )}
          </motion.div>
        </motion.div>
      </Shell>
    );
  }

  // ---- Paid confirmation ----
  if (paid) {
    return (
      <PaidScreen
        paid={paid}
        currency={currency}
        restaurantName={restaurantName}
        locationName={locationName}
        tableLabel={tableLabel}
        token={token}
        test={!squareEnabled}
        accent={accent}
        Shell={Shell}
        onBack={() => {
          setPaid(null);
          setView("home");
        }}
      />
    );
  }

  const BackRow = ({ title }: { title: string }) => (
    <div className="flex items-center gap-3 mb-4 pt-4">
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        transition={SPRING_PRESS}
        onClick={() => setView("home")}
        aria-label="Back"
        className="h-11 w-11 rounded-pill bg-surface border border-line shadow-rest flex items-center justify-center text-ink-soft hover:text-ink"
      >
        <svg viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4l-6 6 6 6" />
        </svg>
      </motion.button>
      <h1 className="font-display text-display-sm font-semibold">{title}</h1>
    </div>
  );

  // ---- HOME ----
  if (view === "home") {
    const billLive = !!bill && remaining > 0;
    return (
      <Shell>
        {/* First-load brand sweep. Decides on mount whether to play (once per
            tab session per token; never under reduced motion) — mounted only
            with the landing, so Menu -> Back remounts it but the session
            guard keeps it from replaying. */}
        <BrandIntro token={token} />
        <motion.div variants={stagger(0.07, 0.05)} initial="hidden" animate="show" className="max-w-md md:max-w-lg mx-auto pb-10">
          {/* Hero: full-bleed cover (or the brand gradient), venue identity
              overlapping its bottom edge, table as a badge. */}
          <div className="relative h-52 sm:h-60 md:h-72 md:rounded-b-[var(--radius-xl)] overflow-hidden">
            {coverUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <motion.img
                src={coverUrl}
                alt=""
                initial={{ scale: 1.06, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={easeOut(0.9)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <>
                <div className="absolute inset-0 bg-accent-gradient" />
                <div aria-hidden className="absolute inset-0" style={{ ...patternBackgroundStyle("dots", "#ffffff"), opacity: 0.18 }} />
              </>
            )}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, var(--color-paper) 0%, color-mix(in srgb, var(--color-paper) 35%, transparent) 55%, transparent 100%)",
              }}
            />
          </div>

          <div className="relative -mt-12 px-5 text-center">
            <motion.div variants={pop} className="mx-auto w-[88px] h-[88px] rounded-[var(--radius-lg)] shadow-float overflow-hidden ring-4 ring-[var(--color-paper)] bg-surface">
              {logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={logoUrl} alt={restaurantName} className="w-full h-full object-cover" loading="eager" decoding="async" />
              ) : (
                <div className="w-full h-full bg-accent-gradient text-on-accent flex items-center justify-center font-display text-display-sm font-semibold">
                  {restaurantName.trim().charAt(0).toUpperCase()}
                </div>
              )}
            </motion.div>
            <motion.h1 variants={fadeUp} className="font-display text-display font-semibold mt-4">
              {restaurantName}
            </motion.h1>
            {tagline && (
              <motion.p variants={fadeUp} className="text-sm text-ink-soft mt-1">
                {tagline}
              </motion.p>
            )}
            <motion.div variants={fadeUp} className="mt-3 inline-flex items-center gap-2 rounded-pill bg-surface border border-line shadow-rest px-3.5 h-9 text-sm">
              <span className="w-2 h-2 rounded-pill bg-pine" aria-hidden />
              <span className="font-semibold">Table {tableLabel}</span>
              <span className="text-muted">· {locationName}</span>
            </motion.div>
          </div>

          <div className="px-5 mt-7 space-y-3">
            {!open && (
              <motion.div variants={fadeUp} className="rounded-[var(--radius-card)] bg-warn-soft text-warn px-4 py-3.5">
                <p className="font-semibold text-sm">We&apos;re closed right now</p>
                <p className="text-xs mt-0.5 opacity-90">You can browse the menu — ordering opens when we do.</p>
              </motion.div>
            )}

            {orders.length > 0 && (
              <motion.div variants={fadeUp} className="rounded-[var(--radius-card)] bg-surface shadow-raised p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Your orders</h2>
                <ul className="space-y-4">
                  {orders.map((o) => (
                    <li key={o.id}>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm text-ink-soft flex-1 min-w-0">
                          {o.orderNumber != null && <span className="text-muted font-semibold">#{o.orderNumber} </span>}
                          {o.items.join(", ")}
                        </span>
                        {(o.status === "SUBMITTED" || o.status === "PENDING" || o.status === "AWAITING_PAYMENT") && (
                          <button
                            onClick={() => onCancel(o.id)}
                            disabled={cancelling}
                            className="shrink-0 text-xs text-muted hover:text-danger disabled:opacity-50 underline underline-offset-2"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      <div className="mt-2.5 max-w-[240px]">
                        <OrderTracker status={o.status} compact />
                      </div>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* One hero action, two secondary. */}
            <motion.div variants={fadeUp}>
              <Button
                variant="primary"
                size="lg"
                full
                onClick={() => setView("menu")}
                className="justify-between h-[68px] px-5"
              >
                <span className="text-left">
                  <span className="block font-display text-lg font-semibold leading-tight">
                    {canOrder ? "Menu & order" : "View menu"}
                  </span>
                  <span className="block text-xs opacity-85 mt-0.5">
                    {canOrder ? "Browse and add to your table" : "See what's on offer"}
                  </span>
                </span>
                <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 4l6 6-6 6" />
                </svg>
              </Button>
            </motion.div>

            {/* Two secondary tiles, same chrome as each other: icon top-left,
                label + detail bottom, resting elevation, press scale. Bill
                & pay steps up (accent tint, raised shadow, accent icon) the
                moment there's a live balance; quiet otherwise. */}
            <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={SPRING_PRESS}
                onClick={() => setView("bill")}
                className={`rounded-[var(--radius-lg)] p-4 text-left min-h-[92px] flex flex-col justify-between transition-[background-color,box-shadow,border-color] duration-[var(--dur-base)] ${
                  billLive
                    ? "bg-pine-tint border border-pine/30 shadow-raised"
                    : "bg-surface border border-line shadow-rest hover:shadow-raised"
                }`}
              >
                <span
                  className={`inline-flex w-8 h-8 items-center justify-center rounded-pill transition-colors duration-[var(--dur-base)] ${
                    billLive ? "bg-pine text-on-accent" : "bg-surface-2 text-ink-soft"
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
                    <path d="M9 8h6M9 12h6" />
                  </svg>
                </span>
                <span>
                  <span className="block font-display text-base font-semibold leading-tight">{canPay ? "Bill & pay" : "Your bill"}</span>
                  {billLive ? (
                    <AnimatedMoney cents={remaining} currency={currency} className="block font-display text-xl font-semibold mt-0.5" />
                  ) : (
                    <span className="block text-xs text-muted mt-0.5">{bill && bill.items.length > 0 ? "All paid up" : "Nothing on the tab yet"}</span>
                  )}
                </span>
              </motion.button>
              <CallStaff token={token} variant="tile" />
            </motion.div>
          </div>

          <motion.div variants={fadeUp} className="px-5">
            {(instagramHandle || websiteUrl) && (
              <div className="mt-8 flex items-center justify-center gap-4 text-sm text-muted">
                {instagramHandle && (
                  <a
                    href={`https://instagram.com/${instagramHandle.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-ink"
                  >
                    @{instagramHandle.replace(/^@/, "")}
                  </a>
                )}
                {websiteUrl && (
                  <a
                    href={/^https?:\/\//.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-ink"
                  >
                    Website
                  </a>
                )}
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-3 text-xs text-muted">
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-ink">Terms</a>
              <span>·</span>
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-ink">Privacy</a>
              <span>·</span>
              <a href="/support" target="_blank" rel="noopener noreferrer" className="hover:text-ink">Support</a>
            </div>
            {showTillzBranding && (
              <p className="mt-3 text-center text-[11px] text-muted">
                Powered by{" "}
                <a href="/" target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-ink">
                  Tillz
                </a>
              </p>
            )}
          </motion.div>
        </motion.div>
      </Shell>
    );
  }

  // ---- MENU ----
  if (view === "menu") {
    return (
      <Shell>
        <div className="max-w-md md:max-w-3xl mx-auto px-5">
          <div className="flex items-center gap-3">
            <BackRow title="Menu" />
            <div className="ml-auto pt-4 mb-4">
              <CallStaff token={token} variant="pill" />
            </div>
          </div>
          {menu.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
              This restaurant hasn&apos;t published its menu yet.
            </div>
          ) : canOrder ? (
            <MenuOrderer
              menu={menu}
              currency={currency}
              reviewStep
              submitLabel={(n) => (n === 1 ? "Review order" : "Review order")}
              onSubmit={submitOrder}
              onPlaced={handlePlaced}
              layout={menuLayout}
              cardStyle={cardStyle}
              typeScale={typeScale}
              sectionHeaderStyle={sectionHeaderStyle}
              buttonShape={buttonShape}
              buttonFill={buttonFill}
              persistKey={token}
            />
          ) : (
            <>
              <p className="text-sm text-muted mb-4">
                Your server will take your order — tap “Call staff” when you&apos;re ready.
              </p>
              <MenuDisplay
                menu={menu}
                currency={currency}
                layout={menuLayout}
                cardStyle={cardStyle}
                sectionHeaderStyle={sectionHeaderStyle}
                typeScale={typeScale}
              />
            </>
          )}
        </div>
      </Shell>
    );
  }

  // ---- BILL ----
  return (
    <Shell>
      <div className="max-w-md md:max-w-lg mx-auto px-5 pb-10">
        <BackRow title="Your bill" />

        {!bill || bill.items.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-10 text-center">
            <p className="font-display text-lg font-semibold">Nothing on the tab yet</p>
            <p className="text-sm text-muted mt-1">Order from the menu and it&apos;ll show up here.</p>
            <Button variant="secondary" className="mt-5" onClick={() => setView("menu")}>
              Browse the menu
            </Button>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={easeOut(0.35)} className="rounded-[var(--radius-card)] bg-surface shadow-raised overflow-hidden">
            <div className="px-5 pt-5 pb-4 flex items-baseline justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Table {tableLabel}</p>
                <p className="font-display text-lg font-semibold mt-0.5">{restaurantName}</p>
              </div>
              <p className="text-xs text-muted">{bill.items.reduce((n, it) => n + it.quantity, 0)} items</p>
            </div>
            <div className="border-t border-dashed border-line-strong mx-5" />
            <ul className="px-5 py-3 divide-y divide-line">
              {bill.items.map((it) => (
                <li key={it.id} className="flex justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="text-muted tabular mr-1.5">{it.quantity}×</span>
                    <span className="font-medium">{it.nameSnapshot}</span>
                    {it.modifiers && it.modifiers.length > 0 && (
                      <span className="block text-xs text-muted pl-6">{it.modifiers.map((m) => m.name).join(", ")}</span>
                    )}
                  </span>
                  <span className="tabular shrink-0">{formatCents(it.lineTotalCents, currency)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-dashed border-line-strong mx-5" />
            <div className="px-5 py-4 space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className="font-semibold">Total</span>
                <AnimatedMoney cents={bill.totalCents} currency={currency} className="font-display text-money font-semibold" />
              </div>
              {bill.amountPaidCents > 0 && (
                <>
                  <div className="flex justify-between text-sm text-muted">
                    <span>Already paid</span>
                    <span className="tabular">−{formatCents(bill.amountPaidCents, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Remaining</span>
                    <AnimatedMoney cents={remaining} currency={currency} />
                  </div>
                </>
              )}
            </div>

            {remaining > 0 && canPay && (
              <div className="px-5 pb-5 flex gap-2.5">
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1 justify-between"
                  onClick={() => {
                    setPayMode(allowedModes.includes("full") ? "full" : allowedModes[0] ?? "full");
                    setPayOpen(true);
                  }}
                >
                  <span>Pay</span>
                  <AnimatedMoney cents={remaining} currency={currency} className="font-display text-lg" />
                </Button>
                {allowedModes.includes("equal") && allowedModes.includes("full") && (
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => {
                      setPayMode("equal");
                      setPayOpen(true);
                    }}
                  >
                    Split
                  </Button>
                )}
              </div>
            )}
            {remaining > 0 && !canPay && (
              <p className="text-sm text-muted px-5 pb-5 text-center">Please pay at the counter or ask your server.</p>
            )}
            {remaining <= 0 && (
              <p className="text-sm text-pine-deep font-medium px-5 pb-5 text-center">All paid up — thank you.</p>
            )}
          </motion.div>
        )}
      </div>

      {bill && (
        <PaySheet
          token={token}
          currency={currency}
          items={bill.items}
          remainingCents={remaining}
          totalCents={bill.totalCents}
          open={payOpen}
          initialMode={payMode}
          tipEnabled={tipEnabled}
          tipPresets={tipPresets}
          surchargeEnabled={surchargeEnabled}
          surchargeBasisPoints={surchargeBasisPoints}
          allowedModes={allowedModes}
          squareEnabled={squareEnabled}
          squareAppId={squareAppId}
          squareLocationId={squareLocationId}
          squareEnv={squareEnv}
          onClose={() => setPayOpen(false)}
          onPaid={(amountCents, fullyPaid) => {
            setPayOpen(false);
            setPaid({
              amountCents,
              fullyPaid,
              remainingAfter: Math.max(0, remaining - amountCents),
              totalCents: bill.totalCents,
            });
          }}
        />
      )}
    </Shell>
  );
}

// ---- Payment success: the peak moment. -------------------------------------
function PaidScreen({
  paid,
  currency,
  restaurantName,
  locationName,
  tableLabel,
  token,
  test,
  accent,
  Shell,
  onBack,
}: {
  paid: Paid;
  currency: string;
  restaurantName: string;
  locationName: string;
  tableLabel: string;
  token: string;
  test: boolean;
  accent: string;
  Shell: (p: { children: React.ReactNode; live?: boolean }) => React.ReactElement;
  onBack: () => void;
}) {
  useEffect(() => {
    // Venue-coloured confetti; reduced-motion users get none (celebrate()
    // checks the OS preference itself).
    const t = setTimeout(() => celebrate([accent, onAccent(accent), "#ffffff"]), 250);
    return () => clearTimeout(t);
  }, [accent]);

  const fraction = paid.totalCents > 0 ? 1 - paid.remainingAfter / paid.totalCents : 1;

  return (
    <Shell live={false}>
      <motion.div
        variants={stagger(0.09, 0.1)}
        initial="hidden"
        animate="show"
        className="max-w-sm mx-auto px-5 pt-10 pb-10 min-h-dvh flex flex-col justify-center text-center"
      >
        <motion.div variants={pop} className="relative mx-auto w-24 h-24">
          {!paid.fullyPaid && (
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r="46" fill="none" stroke="var(--color-surface-2)" strokeWidth="6" />
              <motion.circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="var(--color-pine)"
                strokeWidth="6"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: fraction }}
                transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              />
            </svg>
          )}
          <div className={`absolute inset-2 rounded-pill flex items-center justify-center text-on-accent ${paid.fullyPaid ? "bg-pine shadow-accent inset-0" : "bg-pine"}`}>
            <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <motion.path d="M5 12.5l4.5 4.5L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.2, ease: "easeOut" }} />
            </svg>
          </div>
        </motion.div>

        <motion.p variants={fadeUp} className="text-[11px] uppercase tracking-[0.2em] text-muted mt-6">
          Payment complete
        </motion.p>
        <motion.div variants={fadeUp} className="mt-1.5">
          <AnimatedMoney cents={paid.amountCents} currency={currency} className="font-display text-display-lg font-semibold" duration={0.9} />
        </motion.div>
        <motion.h1 variants={fadeUp} className="font-display text-display-sm font-semibold mt-4">
          Thanks for dining at {restaurantName}
        </motion.h1>
        <motion.p variants={fadeUp} className="text-sm text-muted mt-1">
          {locationName} · Table {tableLabel} · {new Date().toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}
        </motion.p>

        {!paid.fullyPaid && (
          <motion.div variants={fadeUp} className="mt-6 rounded-[var(--radius-card)] bg-surface shadow-raised px-5 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Remaining on this table</span>
              <AnimatedMoney cents={paid.remainingAfter} currency={currency} className="font-semibold" />
            </div>
            <div className="mt-2.5 h-2 rounded-pill bg-surface-2 overflow-hidden">
              <motion.div
                className="h-full rounded-pill bg-pine origin-left"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: fraction }}
                transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <p className="text-xs text-muted mt-2">{Math.round(fraction * 100)}% of the bill is covered.</p>
          </motion.div>
        )}

        {test && (
          <motion.p variants={fadeUp} className="mt-6 text-[11px] uppercase tracking-wide text-warn bg-warn-soft rounded-[var(--radius-sm)] py-2">
            Test payment — no real money moved
          </motion.p>
        )}

        <motion.div variants={fadeUp} className="mt-6 space-y-2.5">
          <Link
            href={`/v/${token}/receipt`}
            className="inline-flex w-full h-12 items-center justify-center rounded-[var(--radius-md)] bg-surface border border-line shadow-rest text-sm font-medium hover:shadow-raised transition-shadow"
          >
            View tax invoice
          </Link>
          <div className="flex justify-center">
            <EmailReceiptForm action={emailMyReceipt.bind(null, token)} />
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-8">
          <Button variant="ghost" size="md" full onClick={onBack}>
            Back to menu
          </Button>
        </motion.div>
      </motion.div>
    </Shell>
  );
}
