"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { payBill, payItems } from "./actions";
import { formatCents, dollarsToCents } from "@/lib/money";

type BillItem = {
  id: string;
  nameSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  paidQuantity: number;
  lineTotalCents: number;
};

type Mode = "full" | "equal" | "items" | "custom";

export function PaySheet({
  token,
  currency,
  items,
  remainingCents,
  open,
  initialMode = "full",
  tipEnabled = false,
  tipPresets = [],
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
  onClose: () => void;
  onPaid: (amountCents: number, fullyPaid: boolean) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [people, setPeople] = useState(2);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [customValue, setCustomValue] = useState("");
  const [tipPreset, setTipPreset] = useState<number | "custom" | null>(null);
  const [tipCustom, setTipCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paying, start] = useTransition();

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

  function pay() {
    const amount = chosenAmount();
    if (mode === "items" && itemsTotal <= 0) {
      setError("Select at least one item.");
      return;
    }
    if (mode === "custom" && (customCents === null || customCents <= 0)) {
      setError("Enter a valid amount, e.g. 20 or 20.50.");
      return;
    }
    setError(null);
    const optimistic = amount ?? remainingCents;
    start(async () => {
      const res =
        mode === "items"
          ? await payItems(token, itemSelections, tipCents)
          : await payBill(token, amount, tipCents);
      if (res && "error" in res) {
        setError(res.error);
        router.refresh();
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

          {/* Mode tabs */}
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-paper p-1 mb-4 text-sm">
            {(
              [
                ["full", "Full"],
                ["equal", "Equally"],
                ["items", "Items"],
                ["custom", "Custom"],
              ] as [Mode, string][]
            ).map(([m, label]) => (
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

          {mode === "custom" && (
            <div className="mb-4">
              <label className="text-sm text-muted mb-1 block">
                Amount to pay
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                  $
                </span>
                <input
                  inputMode="decimal"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="20.00"
                  className="w-full rounded-lg border border-line bg-surface pl-7 pr-3.5 py-2.5 focus:border-pine focus:outline-none"
                />
              </div>
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

          {error && (
            <p className="mb-3 rounded-lg bg-danger-soft text-danger px-3.5 py-2.5 text-sm">
              {error}
            </p>
          )}

          <button
            onClick={pay}
            disabled={paying}
            className="w-full rounded-xl bg-pine text-white py-3.5 font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {paying
              ? "Processing…"
              : `Pay ${formatCents(Math.min(payBase, remainingCents) + tipCents, currency)}${
                  tipCents > 0 ? ` (incl. ${formatCents(tipCents, currency)} tip)` : ""
                } · test`}
          </button>
          <p className="text-center text-[11px] text-muted mt-3">
            Test payment — no real money moves. Amounts are capped at the
            remaining balance.
          </p>
        </div>
      </div>
    </div>
  );
}
