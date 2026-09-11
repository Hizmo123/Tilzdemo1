"use client";

import { useState, useTransition, useRef } from "react";
import { formatCents } from "@/lib/money";

export type OrderOption = { id: string; name: string; priceDeltaCents: number };
export type OrderGroup = {
  id: string;
  name: string;
  required: boolean;
  maxSelect: number;
  options: OrderOption[];
};
export type OrderMenuItem = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  available: boolean;
  imageUrl: string | null;
  allergens: string[];
  groups: OrderGroup[];
};
export type OrderCategory = { id: string; name: string; items: OrderMenuItem[] };

export type CartLine = {
  key: string;
  menuItemId: string;
  name: string;
  quantity: number;
  optionIds: string[];
  optionLabel: string;
  unitCents: number;
};

// A self-contained "browse menu → choose options → build cart → send" surface.
// onSubmit receives the cart lines (and an optional order note) and returns an
// optional error. Used by the customer page and the staff order panel so both
// price and validate identically.
//
// reviewStep = true (customer) inserts a review-and-confirm sheet before sending
// and reports a placed summary via onPlaced so the parent can show a success
// screen. reviewStep = false (staff) sends immediately, unchanged.
export function MenuOrderer({
  menu,
  currency,
  submitLabel,
  onSubmit,
  reviewStep = false,
  onPlaced,
}: {
  menu: OrderCategory[];
  currency: string;
  submitLabel: (count: number) => string;
  onSubmit: (
    lines: { menuItemId: string; quantity: number; optionIds: string[] }[],
    note?: string,
    clientRequestId?: string,
  ) => Promise<{ error?: string } | { ok: true }>;
  reviewStep?: boolean;
  onPlaced?: (summary: { name: string; quantity: number }[]) => void;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sheetItem, setSheetItem] = useState<OrderMenuItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  // Stable idempotency key for the current order. Kept across retries so a
  // resend of a failed request can't create a duplicate; cleared on success.
  const submitKeyRef = useRef<string | null>(null);

  const count = cart.reduce((a, l) => a + l.quantity, 0);
  const subtotal = cart.reduce((a, l) => a + l.unitCents * l.quantity, 0);

  function addSimple(item: OrderMenuItem) {
    setCart((c) => {
      const existing = c.find(
        (l) => l.menuItemId === item.id && l.optionIds.length === 0,
      );
      if (existing)
        return c.map((l) =>
          l === existing ? { ...l, quantity: l.quantity + 1 } : l,
        );
      return [
        ...c,
        {
          key: crypto.randomUUID(),
          menuItemId: item.id,
          name: item.name,
          quantity: 1,
          optionIds: [],
          optionLabel: "",
          unitCents: item.priceCents,
        },
      ];
    });
  }

  function addConfigured(line: CartLine) {
    setCart((c) => [...c, line]);
  }

  function changeQty(key: string, delta: number) {
    setCart((c) =>
      c
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  // Fired by the sticky button. With reviewStep, open the review sheet; without
  // it (staff), send straight away.
  function primaryAction() {
    if (cart.length === 0) return;
    if (reviewStep) setReviewOpen(true);
    else send();
  }

  function send() {
    if (cart.length === 0) return;
    setError(null);
    const summary = cart.map((l) => ({
      name: l.optionLabel ? `${l.name} · ${l.optionLabel}` : l.name,
      quantity: l.quantity,
    }));
    const key = submitKeyRef.current ?? crypto.randomUUID();
    submitKeyRef.current = key;
    start(async () => {
      const res = await onSubmit(
        cart.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
          optionIds: l.optionIds,
        })),
        note.trim() || undefined,
        key,
      );
      if (res && "error" in res && res.error) {
        setError(res.error); // keep the key so a retry dedupes
      } else {
        setCart([]);
        setNote("");
        setReviewOpen(false);
        submitKeyRef.current = null;
        onPlaced?.(summary);
      }
    });
  }

  return (
    <div className="pb-32">
      {cart.length > 0 && (
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 mb-6">
          <h3 className="text-sm font-medium text-muted mb-2">Your selection</h3>
          <ul className="space-y-2">
            {cart.map((l) => (
              <li key={l.key} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{l.name}</span>
                  {l.optionLabel && (
                    <span className="block text-xs text-muted">{l.optionLabel}</span>
                  )}
                </div>
                <span className="text-sm tabular-nums text-muted">
                  {formatCents(l.unitCents * l.quantity, currency)}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => changeQty(l.key, -1)}
                    className="w-7 h-7 rounded-full border border-line text-base leading-none"
                  >
                    −
                  </button>
                  <span className="w-4 text-center text-sm tabular-nums">
                    {l.quantity}
                  </span>
                  <button
                    onClick={() => changeQty(l.key, 1)}
                    className="w-7 h-7 rounded-full border border-line text-base leading-none"
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-6">
        {menu.map((cat) => (
          <section key={cat.id}>
            <h3 className="font-display text-lg font-semibold tracking-tight mb-2">
              {cat.name}
            </h3>
            <ul className="space-y-2">
              {cat.items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-[var(--radius-card)] border border-line bg-surface p-4 flex items-start gap-3"
                >
                  {item.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.imageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-16 h-16 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${item.available ? "" : "text-muted"}`}>
                        {item.name}
                      </span>
                      {!item.available && (
                        <span className="text-[10px] uppercase tracking-wide bg-paper text-muted px-1.5 py-0.5 rounded">
                          Sold out
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted mt-0.5">{item.description}</p>
                    )}
                    {item.allergens.length > 0 && (
                      <p className="text-[11px] text-muted mt-1">
                        Contains: {item.allergens.join(", ")}
                      </p>
                    )}
                    <p className="text-sm font-medium mt-1 tabular-nums">
                      {formatCents(item.priceCents, currency)}
                    </p>
                  </div>
                  {item.available && (
                    <button
                      onClick={() =>
                        item.groups.length > 0
                          ? setSheetItem(item)
                          : addSimple(item)
                      }
                      className="shrink-0 rounded-lg bg-ink text-surface px-4 py-2 text-sm font-medium hover:opacity-90"
                    >
                      Add
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-danger-soft text-danger px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}

      {count > 0 && (
        <div className="fixed bottom-0 inset-x-0 border-t border-line bg-surface/95 backdrop-blur px-5 py-4">
          <div className="max-w-sm mx-auto">
            <button
              onClick={primaryAction}
              disabled={pending}
              className="w-full rounded-xl bg-pine text-[color:var(--on-accent,#fff)] py-3.5 font-medium hover:bg-pine-deep disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <span>{pending ? "Sending…" : submitLabel(count)}</span>
              <span className="tabular-nums opacity-90">
                {formatCents(subtotal, currency)}
              </span>
            </button>
          </div>
        </div>
      )}

      {sheetItem && (
        <ModifierSheet
          item={sheetItem}
          currency={currency}
          onClose={() => setSheetItem(null)}
          onConfirm={(line) => {
            addConfigured(line);
            setSheetItem(null);
          }}
        />
      )}

      {reviewOpen && (
        <ReviewSheet
          cart={cart}
          currency={currency}
          subtotal={subtotal}
          note={note}
          setNote={setNote}
          pending={pending}
          error={error}
          onChangeQty={changeQty}
          onClose={() => setReviewOpen(false)}
          onPlace={send}
        />
      )}
    </div>
  );
}

// The customer's review-and-confirm step: last look at the order, adjust
// quantities, add a note for the kitchen, then place it.
function ReviewSheet({
  cart,
  currency,
  subtotal,
  note,
  setNote,
  pending,
  error,
  onChangeQty,
  onClose,
  onPlace,
}: {
  cart: CartLine[];
  currency: string;
  subtotal: number;
  note: string;
  setNote: (v: string) => void;
  pending: boolean;
  error: string | null;
  onChangeQty: (key: string, delta: number) => void;
  onClose: () => void;
  onPlace: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40">
      <div className="w-full max-w-sm bg-surface rounded-t-2xl border-t border-line max-h-[88dvh] overflow-y-auto">
        <div className="sticky top-0 bg-surface border-b border-line px-5 py-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Review your order
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-sm">
            Close
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <ul className="space-y-3">
            {cart.map((l) => (
              <li key={l.key} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{l.name}</span>
                  {l.optionLabel && (
                    <span className="block text-xs text-muted">
                      {l.optionLabel}
                    </span>
                  )}
                </div>
                <span className="text-sm tabular-nums text-muted shrink-0">
                  {formatCents(l.unitCents * l.quantity, currency)}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onChangeQty(l.key, -1)}
                    className="w-7 h-7 rounded-full border border-line text-base leading-none"
                  >
                    −
                  </button>
                  <span className="w-4 text-center text-sm tabular-nums">
                    {l.quantity}
                  </span>
                  <button
                    onClick={() => onChangeQty(l.key, 1)}
                    className="w-7 h-7 rounded-full border border-line text-base leading-none"
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div>
            <label className="text-sm text-muted block mb-1">
              Note for the kitchen{" "}
              <span className="text-xs">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="e.g. no onion, allergy to nuts"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-pine focus:outline-none resize-none"
            />
          </div>

          <div className="flex justify-between font-medium border-t border-line pt-3">
            <span>Total</span>
            <span className="tabular-nums">{formatCents(subtotal, currency)}</span>
          </div>

          {error && (
            <p className="rounded-lg bg-danger-soft text-danger px-3.5 py-2.5 text-sm">
              {error}
            </p>
          )}

          <button
            onClick={onPlace}
            disabled={pending || cart.length === 0}
            className="w-full rounded-xl bg-pine text-[color:var(--on-accent,#fff)] py-3.5 font-medium hover:bg-pine-deep disabled:opacity-60"
          >
            {pending ? "Placing order…" : "Place order"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModifierSheet({
  item,
  currency,
  onClose,
  onConfirm,
}: {
  item: OrderMenuItem;
  currency: string;
  onClose: () => void;
  onConfirm: (line: CartLine) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  function toggle(group: OrderGroup, optionId: string) {
    setError(null);
    setSelected((s) => {
      const cur = s[group.id] ?? [];
      const has = cur.includes(optionId);
      let next: string[];
      if (group.maxSelect === 1) {
        next = has ? [] : [optionId]; // single-choice replaces
      } else if (has) {
        next = cur.filter((x) => x !== optionId);
      } else {
        if (group.maxSelect > 0 && cur.length >= group.maxSelect) return s;
        next = [...cur, optionId];
      }
      return { ...s, [group.id]: next };
    });
  }

  const allOptionIds: string[] = Object.values(selected).flat();
  const delta = item.groups
    .flatMap((g) => g.options)
    .filter((o) => allOptionIds.includes(o.id))
    .reduce((sum, o) => sum + o.priceDeltaCents, 0);
  const unit = item.priceCents + delta;

  function confirm() {
    for (const g of item.groups) {
      const c = (selected[g.id] ?? []).length;
      if (g.required && c < 1) {
        setError(`Please choose ${g.name}.`);
        return;
      }
    }
    const labelParts = item.groups
      .flatMap((g) => g.options)
      .filter((o) => allOptionIds.includes(o.id))
      .map((o) => o.name);
    onConfirm({
      key: crypto.randomUUID(),
      menuItemId: item.id,
      name: item.name,
      quantity,
      optionIds: allOptionIds,
      optionLabel: labelParts.join(", "),
      unitCents: unit,
    });
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-ink/30">
      <div className="w-full max-w-sm bg-surface rounded-t-2xl border-t border-line max-h-[85dvh] overflow-y-auto">
        <div className="sticky top-0 bg-surface border-b border-line px-5 py-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {item.name}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-sm">
            Close
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {item.groups.map((g) => (
            <div key={g.id}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{g.name}</span>
                <span className="text-xs text-muted">
                  {g.required ? "Required" : "Optional"}
                  {g.maxSelect > 1 ? ` · up to ${g.maxSelect}` : ""}
                </span>
              </div>
              <div className="space-y-1.5">
                {g.options.map((o) => {
                  const on = (selected[g.id] ?? []).includes(o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() => toggle(g, o.id)}
                      className={`w-full flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                        on ? "border-pine bg-pine-soft" : "border-line bg-surface"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            on ? "border-pine bg-pine" : "border-line"
                          }`}
                        >
                          {on && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                        {o.name}
                      </span>
                      {o.priceDeltaCents > 0 && (
                        <span className="text-muted tabular-nums">
                          +{formatCents(o.priceDeltaCents, currency)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Quantity</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-full border border-line text-lg leading-none"
              >
                −
              </button>
              <span className="w-5 text-center tabular-nums">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                className="w-8 h-8 rounded-full border border-line text-lg leading-none"
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={confirm}
            className="w-full rounded-xl bg-pine text-white py-3 font-medium hover:bg-pine-deep"
          >
            Add · {formatCents(unit * quantity, currency)}
          </button>
        </div>
      </div>
    </div>
  );
}
