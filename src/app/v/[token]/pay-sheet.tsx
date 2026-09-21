"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { payBill, payItems } from "./actions";
import { formatCents, dollarsToCents } from "@/lib/money";
import { Spinner } from "@/components/ui/submit-button";

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

export function PaySheet({
  token,
  currency,
  items,
  remainingCents,
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
        setError(res.error);
      } else if (res) {
        onPaid(res.amountPaidCents || optimistic, res.fullyPaid);
        router.refresh();
      }
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-ink/30">
      <div className="w-full max-w-sm bg-surface rounded-t-2xl border-t border-line max-h-[85dvh] overflow-y-auto">
        <div className="sticky top-0 bg-surface border-b border-line px-5 py-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Pay your bill
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-sm"
          >
            Close
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm text-muted mb-3">
            Remaining on this table:{" "}
            <span className="font-medium text-ink">
              {formatCents(remainingCents, currency)}
            </span>
          </p>

          {/* Mode tabs — only the split methods this venue actually offers */}
          <div
            className="grid gap-1 rounded-lg bg-paper p-1 mb-4 text-sm"
            style={{ gridTemplateColumns: `repeat(${visibleModes.length}, minmax(0, 1fr))` }}
          >
            {(
              [
                ["full", "Full"],
                ["equal", "Equally"],
                ["items", "Items"],
              ] as [Mode, string][]
            )
              .filter(([m]) => visibleModes.includes(m))
              .map(([m, label]) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`rounded-md py-1.5 transition-colors ${
                  mode === m ? "bg-surface shadow-sm font-medium" : "text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "equal" && (
            <div className="mb-4">
              <p className="text-sm text-muted mb-2">How many people?</p>
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => setPeople((p) => Math.max(1, p - 1))}
                  className="w-9 h-9 rounded-full border border-line text-lg"
                >
                  −
                </button>
                <span className="w-8 text-center font-medium tabular-nums">
                  {people}
                </span>
                <button
                  onClick={() => setPeople((p) => Math.min(20, p + 1))}
                  className="w-9 h-9 rounded-full border border-line text-lg"
                >
                  +
                </button>
              </div>
              <p className="text-sm">
                Each pays{" "}
                <span className="font-semibold">
                  {formatCents(equalShare, currency)}
                </span>
                <span className="text-muted"> — you&apos;re paying one share</span>
              </p>
            </div>
          )}

          {mode === "items" && (
            <div className="mb-4 space-y-1">
              <p className="text-xs text-muted mb-1">
                Tick the items you&apos;re paying for.
              </p>
              {items.every((it) => it.quantity - it.paidQuantity <= 0) ? (
                <p className="text-sm text-muted py-2">
                  Every item has been paid for.
                </p>
              ) : (
                items.map((it) => {
                  const available = it.quantity - it.paidQuantity;
                  if (available <= 0) return null;
                  return (
                    <div key={it.id}>
                      {Array.from({ length: available }).map((_, u) => {
                        const key = `${it.id}#${u}`;
                        return (
                          <label
                            key={key}
                            className="flex items-center gap-3 py-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={!!selected[key]}
                              onChange={(e) =>
                                setSelected((s) => ({
                                  ...s,
                                  [key]: e.target.checked,
                                }))
                              }
                              className="w-4 h-4 accent-pine"
                            />
                            <span className="flex-1 text-sm">
                              {it.nameSnapshot}
                            </span>
                            <span className="text-sm tabular-nums">
                              {formatCents(it.unitPriceCents, currency)}
                            </span>
                          </label>
                        );
                      })}
                      {it.paidQuantity > 0 && (
                        <p className="text-xs text-muted pl-7 pb-1">
                          {it.paidQuantity} already paid
                        </p>
                      )}
                    </div>
                  );
                })
              )}
              <p className="text-sm pt-2 border-t border-line">
                Your total:{" "}
                <span className="font-semibold">
                  {formatCents(itemsTotal, currency)}
                </span>
              </p>
            </div>
          )}

          {tipEnabled && (
            <div className="mb-4">
              <p className="text-sm text-muted mb-2">Add a tip?</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTipPreset(tipPreset === null ? "custom" : null)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    tipPreset === null ? "border-pine bg-pine-soft" : "border-line"
                  }`}
                >
                  No tip
                </button>
                {tipPresets.map((p) => (
                  <button
                    key={p}
                    onClick={() => setTipPreset(p)}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      tipPreset === p ? "border-pine bg-pine-soft" : "border-line"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
                <button
                  onClick={() => setTipPreset("custom")}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    tipPreset === "custom" ? "border-pine bg-pine-soft" : "border-line"
                  }`}
                >
                  Custom
                </button>
              </div>
              {tipPreset === "custom" && (
                <div className="relative mt-2">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                    $
                  </span>
                  <input
                    inputMode="decimal"
                    value={tipCustom}
                    onChange={(e) => setTipCustom(e.target.value)}
                    placeholder="5.00"
                    className="w-full rounded-lg border border-line bg-surface pl-7 pr-3.5 py-2.5 focus:border-pine focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {surchargeCents > 0 && (
            <p className="mb-3 flex justify-between text-sm text-muted rounded-lg bg-paper px-3.5 py-2.5">
              <span>Card surcharge</span>
              <span className="tabular-nums text-ink">
                +{formatCents(surchargeCents, currency)}
              </span>
            </p>
          )}

          {squareEnabled && (
            <div className="mb-4">
              <p className="text-sm text-muted mb-2">Card details</p>
              <div
                id="square-card-container"
                className="rounded-lg border border-line bg-surface px-3.5 py-2.5 min-h-[44px]"
              />
              {squareStatus === "loading" && (
                <p className="text-xs text-muted mt-1.5">Loading card form…</p>
              )}
              {squareStatus === "error" && (
                <p className="text-xs text-danger mt-1.5">
                  Couldn&apos;t load the card form. Please refresh and try again.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="mb-3 rounded-lg bg-danger-soft text-danger px-3.5 py-2.5 text-sm">
              {error}
            </p>
          )}

          <button
            onClick={pay}
            disabled={paying || (squareEnabled && squareStatus !== "ready")}
            className="w-full rounded-xl bg-pine text-white py-3.5 font-medium hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2"
          >
            {paying && <Spinner />}
            {paying
              ? "Processing…"
              : `Pay ${formatCents(Math.min(payBase, remainingCents) + tipCents + surchargeCents, currency)}${
                  tipCents > 0 ? ` (incl. ${formatCents(tipCents, currency)} tip)` : ""
                }${squareEnabled ? "" : " · test"}`}
          </button>
          <p className="text-center text-[11px] text-muted mt-3">
            {squareEnabled
              ? "Amounts are capped at the remaining balance."
              : "Test payment — no real money moves. Amounts are capped at the remaining balance."}
          </p>
        </div>
      </div>
    </div>
  );
}
