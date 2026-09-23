"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { payBill, payItems } from "./actions";
import { formatCents, dollarsToCents } from "@/lib/money";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Chip, SegmentedControl } from "@/components/ui/chip";
import { AnimatedMoney } from "@/components/ui/animated-number";
import { SPRING_PRESS, SPRING_SOFT, haptic } from "@/components/ui/motion";

// Square's Web Payments SDK attaches itself to window.Square once its script
// tag loads — there's no npm package for the browser side (only the server
// SDK, used elsewhere in src/lib/square/). Minimal shape of what's actually
// used here, not the full SDK surface.
type SquareCard = {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{
    status: string;
    token?: string;
    errors?: { message: string }[];
  }>;
  destroy: () => Promise<void>;
};
type SquarePayments = { card: () => Promise<SquareCard> };
declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => Promise<SquarePayments> };
  }
}

const SQUARE_SDK_URL: Record<string, string> = {
  sandbox: "https://sandbox.web.squarecdn.com/v1/square.js",
  production: "https://web.squarecdn.com/v1/square.js",
};

let squareSdkPromise: Promise<void> | null = null;
function loadSquareSdk(env: string): Promise<void> {
  if (window.Square) return Promise.resolve();
  if (squareSdkPromise) return squareSdkPromise;
  squareSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SQUARE_SDK_URL[env] ?? SQUARE_SDK_URL.sandbox;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Couldn't load the card payment form."));
    document.head.appendChild(script);
  });
  return squareSdkPromise;
}

type BillItem = {
  id: string;
  nameSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  paidQuantity: number;
  lineTotalCents: number;
};

export type Mode = "full" | "equal" | "items" | "custom";

// "custom" is a real server capability (payBillAmount still accepts it, see
// FIX 1's defensive guard there) but is no longer offered in this UI per the
// owner's decision — filtered out of allowedModes below regardless of what a
// venue's splitMethods setting contains, not just left out of ALL_MODES.
const ALL_MODES: Mode[] = ["full", "equal", "items", "custom"];
const CUSTOMER_VISIBLE_MODES: Mode[] = ["full", "equal", "items"];
const MODE_LABEL: Record<Mode, string> = { full: "Full", equal: "Equally", items: "Items", custom: "Custom" };

export function PaySheet({
  token,
  currency,
  items,
  remainingCents,
  totalCents,
  open,
  initialMode = "full",
  tipEnabled = false,
  tipPresets = [],
  surchargeEnabled = false,
  surchargeBasisPoints = 0,
  allowedModes = ALL_MODES,
  squareEnabled = false,
  squareAppId = null,
  squareLocationId = null,
  squareEnv = null,
  onClose,
  onPaid,
}: {
  token: string;
  currency: string;
  items: BillItem[];
  remainingCents: number;
  // Whole-bill total — only used to show how many equal seats are already
  // covered by earlier payments.
  totalCents?: number;
  open: boolean;
  initialMode?: Mode;
  tipEnabled?: boolean;
  tipPresets?: number[];
  surchargeEnabled?: boolean;
  surchargeBasisPoints?: number;
  // Which split methods this venue offers. Hiding a tab here is presentation
  // only — the server re-checks the same restriction, so this can never be
  // the only thing standing between a guest and a disallowed payment mode.
  allowedModes?: Mode[];
  // When true, this venue is Square-connected (Phase 3) — a card field is
  // rendered and tokenised client-side; the mock flow below (unchanged) is
  // used for every other venue.
  squareEnabled?: boolean;
  squareAppId?: string | null;
  squareLocationId?: string | null;
  squareEnv?: string | null;
  onClose: () => void;
  onPaid: (amountCents: number, fullyPaid: boolean) => void;
}) {
  const router = useRouter();
  // "custom" is hidden from the customer sheet regardless of what a venue's
  // splitMethods setting exposes — see CUSTOMER_VISIBLE_MODES above.
  const visibleModes = allowedModes.filter((m) => CUSTOMER_VISIBLE_MODES.includes(m));
  const [mode, setMode] = useState<Mode>(
    visibleModes.includes(initialMode) ? initialMode : visibleModes[0] ?? "full",
  );
  const [people, setPeople] = useState(2);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [customValue, setCustomValue] = useState("");
  const [tipPreset, setTipPreset] = useState<number | "custom" | null>(null);
  const [tipCustom, setTipCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paying, start] = useTransition();

  // The sheet can be opened straight into a mode (e.g. "Split" on the bill).
  useEffect(() => {
    if (open) setMode(visibleModes.includes(initialMode) ? initialMode : visibleModes[0] ?? "full");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMode]);

  // ---- Square card field (Phase 3) -----------------------------------------
  const cardRef = useRef<SquareCard | null>(null);
  const [squareStatus, setSquareStatus] = useState<"idle" | "loading" | "ready" | "error">(
    squareEnabled ? "loading" : "idle",
  );

  useEffect(() => {
    if (!open || !squareEnabled || !squareAppId || !squareLocationId) return;
    let cancelled = false;

    setSquareStatus("loading");
    loadSquareSdk(squareEnv ?? "sandbox")
      .then(async () => {
        if (cancelled || !window.Square) return;
        const payments = await window.Square.payments(squareAppId, squareLocationId);
        const card = await payments.card();
        await card.attach("#square-card-container");
        if (cancelled) {
          await card.destroy();
          return;
        }
        cardRef.current = card;
        setSquareStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setSquareStatus("error");
      });

    return () => {
      cancelled = true;
      cardRef.current?.destroy().catch(() => {});
      cardRef.current = null;
    };
    // Re-run only when the sheet opens — squareAppId/locationId/env are
    // fixed for the life of a visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, squareEnabled]);

  // Equal split: round shares up to the cent and clamp to remaining so the bill
  // can always close exactly.
  const equalShare = Math.min(
    Math.ceil(remainingCents / Math.max(1, people)),
    remainingCents,
  );
  // Seats already covered by earlier payments, for the seats visual only.
  const paidSoFar = Math.max(0, (totalCents ?? remainingCents) - remainingCents);
  const seatsPaid = equalShare > 0 ? Math.min(people, Math.floor(paidSoFar / equalShare)) : 0;

  // Item split works at the UNIT level: a line of "2× Flat White" becomes two
  // separately-payable units so each person covers their own. Selection keys are
  // `${billItemId}#${unitIndex}`; already-paid units aren't shown.
  const unitPriceById = new Map(items.map((it) => [it.id, it.unitPriceCents]));
  const selectedUnitKeys = Object.keys(selected).filter((k) => selected[k]);
  const itemsTotal = selectedUnitKeys.reduce(
    (sum, k) => sum + (unitPriceById.get(k.split("#")[0]) ?? 0),
    0,
  );
  const itemSelections = Object.entries(
    selectedUnitKeys.reduce<Record<string, number>>((acc, k) => {
      const id = k.split("#")[0];
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([billItemId, count]) => ({ billItemId, count }));

  const customCents = dollarsToCents(customValue);

  function chosenAmount(): number | null {
    if (mode === "full") return null; // null = full remaining
    if (mode === "equal") return equalShare;
    if (mode === "items") return itemsTotal;
    if (mode === "custom") return customCents;
    return null;
  }

  // Tip is a percentage of the amount this person is paying (or a custom dollar
  // amount). Base = the payer's own amount, not the whole bill.
  const payBase = chosenAmount() ?? remainingCents;
  const tipCents =
    !tipEnabled || tipPreset === null
      ? 0
      : tipPreset === "custom"
        ? (dollarsToCents(tipCustom) ?? 0)
        : Math.round((payBase * tipPreset) / 100);

  // Preview only — disclosed here so the guest sees it before confirming, but
  // the server always recomputes this from the venue's stored rate at charge
  // time, so this number is never trusted for the actual charge.
  const surchargeCents = surchargeEnabled
    ? Math.round((Math.min(payBase, remainingCents) + tipCents) * surchargeBasisPoints / 10000)
    : 0;

  const chargeTotal = Math.min(payBase, remainingCents) + tipCents + surchargeCents;

  function pay() {
    const amount = chosenAmount();
    if (mode === "items" && itemsTotal <= 0) {
      setError("Select at least one item.");
      return;
    }
    if (mode === "custom") {
      // Never let a $0/blank/invalid custom entry fall through to `amount`
      // being null — null means "pay everything" everywhere downstream
      // (see payBillAmount), and that meaning must only ever be reachable
      // from the explicit "full" mode, never from this field.
      if (customCents === null || customCents <= 0) {
        setError("Enter a valid amount, e.g. 20 or 20.50.");
        return;
      }
      if (customCents > remainingCents) {
        setError(`That's more than what's remaining (${formatCents(remainingCents, currency)}).`);
        return;
      }
    }
    if (squareEnabled && squareStatus !== "ready") {
      setError("The card form isn't ready yet — please wait a moment.");
      return;
    }
    setError(null);
    const optimistic = amount ?? remainingCents;
    start(async () => {
      let sourceId: string | undefined;
      if (squareEnabled) {
        const card = cardRef.current;
        if (!card) {
          setError("The card form isn't ready yet — please wait a moment.");
          return;
        }
        const tokenResult = await card.tokenize();
        if (tokenResult.status !== "OK" || !tokenResult.token) {
          setError(tokenResult.errors?.[0]?.message ?? "Check your card details and try again.");
          return;
        }
        sourceId = tokenResult.token;
      }

      const res =
        mode === "items"
          ? await payItems(token, itemSelections, tipCents, sourceId)
          : await payBill(token, amount, tipCents, mode, sourceId);
      if (res && "error" in res) {
        // Deliberately no router.refresh() here — nothing server-side
        // changed on a failed payment (the CAS reserve was released), and a
        // refresh right after setting the error risked the error banner
        // flashing/disappearing under the resulting re-render. The error
        // stays until the user edits an input or taps Pay again (both clear
        // it explicitly) — never auto-cleared, never closes/resets the sheet.
        // res.error is always a plain customer-facing message by the time it
        // reaches here (payBillAmount/payBillItems map any Square failure to
        // a friendly string server-side — the raw category/code/detail never
        // leaves the server); the fallback below is just a backstop against
        // an unexpectedly empty string, not a raw-error filter.
        setError(res.error || "Your payment couldn't be processed. Please try again.");
        haptic([20, 40, 20]);
      } else if (res) {
        // ?? not ||: a genuinely $0 charge (e.g. a fully-discounted/comped
        // bill) is a real, successful result — `||` would treat that falsy
        // zero as "no value" and substitute the optimistic guess instead,
        // which could show a nonzero "Payment complete" amount for a bill
        // that was actually settled for $0.
        onPaid(res.amountPaidCents ?? optimistic, res.fullyPaid);
        router.refresh();
      }
    });
  }

  const shake = { x: [0, -6, 6, -4, 4, 0] };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Pay your bill"
      size="lg"
      footer={
        <div className="space-y-2">
          <AnimatePresence>
            {error && (
              <motion.p
                key={error}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0, ...shake }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                role="alert"
                className="rounded-[var(--radius-md)] bg-danger-soft text-danger px-3.5 py-2.5 text-sm"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <Button
            variant="primary"
            size="lg"
            full
            onClick={pay}
            disabled={paying || (squareEnabled && squareStatus !== "ready")}
            loading={paying}
            className="justify-between"
          >
            <span>{paying ? "Processing…" : squareEnabled ? "Pay now" : "Pay now · test"}</span>
            <AnimatedMoney cents={chargeTotal} currency={currency} className="font-display text-lg" />
          </Button>
          <p className="text-center text-[11px] text-muted">
            {tipCents > 0 ? `Includes ${formatCents(tipCents, currency)} tip. ` : ""}
            {squareEnabled
              ? "Amounts are capped at the remaining balance."
              : "Test payment — no real money moves. Amounts are capped at the remaining balance."}
          </p>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">Remaining on this table</span>
          <span className="font-display text-lg font-semibold tabular">{formatCents(remainingCents, currency)}</span>
        </div>

        {visibleModes.length > 1 && (
          <SegmentedControl
            options={visibleModes.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
              haptic(6);
            }}
          />
        )}

        {mode === "full" && (
          <p className="text-sm text-ink-soft">You&apos;re paying the whole remaining balance.</p>
        )}

        {mode === "equal" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">How many people?</span>
              <div className="inline-flex items-center rounded-pill border border-line bg-surface h-11">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  transition={SPRING_PRESS}
                  onClick={() => setPeople((p) => Math.max(1, p - 1))}
                  className="w-11 h-11 flex items-center justify-center text-lg leading-none"
                  aria-label="Fewer people"
                >
                  −
                </motion.button>
                <span className="w-6 text-center text-sm font-semibold tabular">{people}</span>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.85 }}
                  transition={SPRING_PRESS}
                  onClick={() => setPeople((p) => Math.min(20, p + 1))}
                  className="w-11 h-11 flex items-center justify-center text-lg leading-none"
                  aria-label="More people"
                >
                  +
                </motion.button>
              </div>
            </div>

            {/* Seats: filled = already paid by someone, accent = you. */}
            <div className="flex flex-wrap gap-2" aria-hidden>
              {Array.from({ length: people }).map((_, i) => {
                const paidSeat = i < seatsPaid;
                const you = i === seatsPaid;
                return (
                  <motion.span
                    key={i}
                    layout
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={SPRING_SOFT}
                    className={`w-9 h-9 rounded-pill flex items-center justify-center text-xs font-semibold ${
                      you
                        ? "bg-pine text-on-accent shadow-accent"
                        : paidSeat
                          ? "bg-ink text-surface"
                          : "bg-surface-2 text-muted"
                    }`}
                  >
                    {you ? "You" : paidSeat ? "✓" : i + 1}
                  </motion.span>
                );
              })}
            </div>

            <p className="text-sm">
              Each pays <span className="font-semibold tabular">{formatCents(equalShare, currency)}</span>
              <span className="text-muted"> — you&apos;re paying one share</span>
            </p>
          </div>
        )}

        {mode === "items" && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Tap what you&apos;re paying for.</p>
            {items.every((it) => it.quantity - it.paidQuantity <= 0) ? (
              <p className="text-sm text-muted py-2">Every item has been paid for.</p>
            ) : (
              <div className="space-y-2">
                {items.flatMap((it) => {
                  const available = it.quantity - it.paidQuantity;
                  return Array.from({ length: available }).map((_, u) => {
                    const key = `${it.id}#${u}`;
                    const on = !!selected[key];
                    return (
                      <motion.button
                        key={key}
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        transition={SPRING_PRESS}
                        aria-pressed={on}
                        onClick={() => {
                          haptic(6);
                          setSelected((s) => ({ ...s, [key]: !s[key] }));
                        }}
                        className={`w-full flex items-center gap-3 rounded-[var(--radius-md)] px-3.5 py-3 text-left transition-[background-color,box-shadow,border-color] duration-[var(--dur-fast)] ${
                          on ? "bg-pine-soft border border-pine/40 shadow-rest" : "bg-surface border border-line"
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-pill flex items-center justify-center shrink-0 transition-colors ${
                            on ? "bg-pine text-on-accent" : "border border-line-strong"
                          }`}
                        >
                          {on && (
                            <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <motion.path d="M5 10.5l3.2 3.2L15 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25 }} />
                            </svg>
                          )}
                        </span>
                        <span className={`flex-1 text-sm ${on ? "font-semibold" : ""}`}>{it.nameSnapshot}</span>
                        <span className="text-sm tabular">{formatCents(it.unitPriceCents, currency)}</span>
                      </motion.button>
                    );
                  });
                })}
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 border-t border-line">
              <span className="text-muted">Your items</span>
              <AnimatedMoney cents={itemsTotal} currency={currency} className="font-semibold" />
            </div>
          </div>
        )}

        {tipEnabled && (
          <div>
            <p className="text-sm font-medium mb-2">Add a tip?</p>
            <div className="flex flex-wrap gap-2">
              <Chip selected={tipPreset === null} onClick={() => setTipPreset(null)}>
                No tip
              </Chip>
              {tipPresets.map((p) => (
                <Chip key={p} selected={tipPreset === p} onClick={() => setTipPreset(p)}>
                  {p}%
                </Chip>
              ))}
              <Chip selected={tipPreset === "custom"} onClick={() => setTipPreset("custom")}>
                Custom
              </Chip>
            </div>
            {tipPreset === "custom" && (
              <div className="relative mt-2">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">$</span>
                <input
                  inputMode="decimal"
                  value={tipCustom}
                  onChange={(e) => setTipCustom(e.target.value)}
                  placeholder="5.00"
                  className="w-full rounded-[var(--radius-md)] border border-line bg-surface pl-7 pr-3.5 py-2.5 focus:border-pine focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        {surchargeCents > 0 && (
          <p className="flex justify-between text-sm text-muted rounded-[var(--radius-md)] bg-surface-2 px-3.5 py-2.5">
            <span>Card surcharge</span>
            <span className="tabular text-ink">+{formatCents(surchargeCents, currency)}</span>
          </p>
        )}

        {squareEnabled && (
          <motion.div key={error ? "err" : "ok"} animate={error ? shake : { x: 0 }} transition={{ duration: 0.4 }}>
            <p className="text-sm font-medium mb-2">Card details</p>
            <div
              id="square-card-container"
              className={`rounded-[var(--radius-md)] border bg-surface px-3.5 py-2.5 min-h-[48px] transition-colors ${
                error ? "border-danger" : "border-line"
              }`}
            />
            {squareStatus === "loading" && <p className="text-xs text-muted mt-1.5">Loading secure card form…</p>}
            {squareStatus === "error" && (
              <p className="text-xs text-danger mt-1.5">Couldn&apos;t load the card form. Please refresh and try again.</p>
            )}
          </motion.div>
        )}
      </div>
    </Sheet>
  );
}
