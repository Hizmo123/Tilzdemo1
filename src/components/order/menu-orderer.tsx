"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { formatCents } from "@/lib/money";
import { Spinner } from "@/components/ui/submit-button";
import { BADGE_META, type BadgeKey } from "@/lib/menu-badges";
import {
  resolveCardStyle,
  resolveTypeScale,
  aspectClass,
  cardBorderClass,
  cardShadowClass,
  dividerClass,
  sectionHeaderClass,
  menuButtonClass,
} from "@/lib/menu-style";

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
  badges: string[];
  groups: OrderGroup[];
};
export type OrderCategory = {
  id: string;
  name: string;
  icon: string | null;
  items: OrderMenuItem[];
};

// Small coloured chips for an item's merchandising badges. Unrecognised
// values (schema drift, a badge removed from the app since it was set) are
// silently skipped rather than rendered raw.
function ItemBadges({ badges }: { badges: string[] }) {
  const known = badges.filter((b): b is BadgeKey => b in BADGE_META);
  if (known.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {known.map((b) => {
        const meta = BADGE_META[b];
        return (
          <span
            key={b}
            className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${meta.className}`}
          >
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}

export type CartLine = {
  key: string;
  menuItemId: string;
  name: string;
  quantity: number;
  optionIds: string[];
  optionLabel: string;
  unitCents: number;
  // Free text for this specific line, e.g. "no fries" — distinct from the
  // whole-order note below it in the review sheet. Kitchen sees it right on
  // the ticket line it applies to instead of a separate note someone has to
  // match back to the right item.
  note?: string;
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
  layout = "list",
  cardStyle,
  sectionHeaderStyle = "plain",
  typeScale = "comfortable",
  buttonShape = "rounded",
  buttonFill = "solid",
  persistKey,
}: {
  menu: OrderCategory[];
  currency: string;
  submitLabel: (count: number) => string;
  onSubmit: (
    lines: { menuItemId: string; quantity: number; optionIds: string[]; note?: string }[],
    note?: string,
    clientRequestId?: string,
  ) => Promise<{ error?: string } | { ok: true }>;
  reviewStep?: boolean;
  onPlaced?: (summary: { name: string; quantity: number }[]) => void;
  layout?: string;
  cardStyle?: unknown;
  sectionHeaderStyle?: string;
  typeScale?: string;
  buttonShape?: string;
  buttonFill?: string;
  // When set, the cart + note are persisted to localStorage under this key
  // (see storageKey below) so a customer who leaves the menu mid-browse and
  // comes back — same table, same device — keeps what they'd added.
  // localStorage is per-browser, so a second person at the same table on
  // their own phone never sees this. Omit for the staff order panel, which
  // has no per-visit token and should keep its in-memory-only behaviour.
  persistKey?: string;
}) {
  const cs = resolveCardStyle(layout, cardStyle);
  const ts = resolveTypeScale(typeScale);
  const addBtnClass = menuButtonClass(buttonShape, buttonFill);
  const isMagazine = layout === "magazine";
  const isMinimal = layout === "minimal";
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sheetItem, setSheetItem] = useState<OrderMenuItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  // Stable idempotency key for the current order. Kept across retries — and
  // across an offline gap — so a resend of a failed submit can never create a
  // duplicate on the server, no matter how many times the client retries it.
  const submitKeyRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = persistKey ? `tillz_cart_${persistKey}` : null;
  const hydratedRef = useRef(false);

  // Rehydrate once on mount — not in the useState initializer, since that
  // runs during SSR/hydration where localStorage doesn't exist (or wouldn't
  // match the server-rendered empty cart, causing a hydration mismatch).
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.cart)) setCart(parsed.cart);
        if (typeof parsed?.note === "string") setNote(parsed.note);
      }
    } catch {
      // Private mode / corrupted value — fall back to an empty cart.
    } finally {
      hydratedRef.current = true;
    }
    // Only ever runs once per mount, keyed to this specific storageKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist on every cart/note change, once rehydration has had its chance
  // to run first — otherwise the initial empty-cart render would overwrite
  // whatever was already saved before the hydrate effect gets to read it.
  useEffect(() => {
    if (!storageKey || !hydratedRef.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ cart, note }));
    } catch {
      // Private mode can throw on write too — losing persistence here is
      // fine, the cart just keeps working in memory for this session.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, note, storageKey]);

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

  function changeLineNote(key: string, lineNote: string) {
    setCart((c) => c.map((l) => (l.key === key ? { ...l, note: lineNote } : l)));
  }

  // Fired by the sticky button. With reviewStep, open the review sheet; without
  // it (staff), send straight away.
  function primaryAction() {
    if (cart.length === 0) return;
    if (reviewStep) setReviewOpen(true);
    else send();
  }

  const MAX_AUTO_RETRIES = 5;
  const RETRY_BASE_MS = 1500;

  function send() {
    if (cart.length === 0) return;
    setError(null);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    const summary = cart.map((l) => ({
      name: l.optionLabel ? `${l.name} · ${l.optionLabel}` : l.name,
      quantity: l.quantity,
    }));
    const key = submitKeyRef.current ?? crypto.randomUUID();
    submitKeyRef.current = key;
    const lines = cart.map((l) => ({
      menuItemId: l.menuItemId,
      quantity: l.quantity,
      optionIds: l.optionIds,
      note: l.note?.trim() || undefined,
    }));
    const noteVal = note.trim() || undefined;
    start(() => attemptSend(lines, noteVal, key, summary, 0));
  }

  // A failed *network* attempt (offline, dropped connection — onSubmit
  // rejects rather than resolving) retries automatically with backoff, using
  // the SAME idempotency key every time, so however many attempts it takes,
  // the server only ever creates the order once. A failed *application*
  // response (the server answered with a real error, e.g. sold out) is
  // reported immediately instead — retrying that can't help.
  async function attemptSend(
    lines: { menuItemId: string; quantity: number; optionIds: string[]; note?: string }[],
    noteVal: string | undefined,
    key: string,
    summary: { name: string; quantity: number }[],
    attempt: number,
  ) {
    try {
      const res = await onSubmit(lines, noteVal, key);
      if (res && "error" in res && res.error) {
        setError(res.error); // keep the key so a manual retry still dedupes
        setRetrying(false);
        return;
      }
      setCart([]);
      setNote("");
      if (storageKey) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          // Nothing to do — the in-memory cart is already cleared either way.
        }
      }
      setReviewOpen(false);
      setRetrying(false);
      submitKeyRef.current = null;
      onPlaced?.(summary);
    } catch {
      if (attempt >= MAX_AUTO_RETRIES) {
        setRetrying(false);
        setError("Couldn't send your order — check your connection and try again.");
        return;
      }
      setRetrying(true);
      const delay = RETRY_BASE_MS * 2 ** attempt;
      await new Promise<void>((resolve) => {
        // Retry the moment connectivity comes back, without waiting out the
        // rest of the backoff — offline is the dominant real-world cause.
        const onOnline = () => {
          window.removeEventListener("online", onOnline);
          clearTimeout(retryTimerRef.current!);
          resolve();
        };
        window.addEventListener("online", onOnline);
        retryTimerRef.current = setTimeout(() => {
          window.removeEventListener("online", onOnline);
          resolve();
        }, delay);
      });
      return attemptSend(lines, noteVal, key, summary, attempt + 1);
    }
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

      <div className={isMagazine ? "space-y-10" : "space-y-6"}>
        {menu.map((cat) => (
          <section key={cat.id}>
            <h3
              style={{ fontSize: isMagazine ? `calc(${ts.categoryHeader} + 4px)` : ts.categoryHeader }}
              className={`font-display font-semibold tracking-tight mb-3 flex items-center gap-1.5 ${sectionHeaderClass(sectionHeaderStyle)}`}
            >
              {cat.icon && <span aria-hidden>{cat.icon}</span>}
              {cat.name}
            </h3>

            {isMinimal ? (
              <div className={dividerClass(cs.divider) ? "divide-y divide-line" : "space-y-1"}>
                {cat.items.map((item) => (
                  <div key={item.id} className="flex items-baseline justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <span
                        style={{ fontSize: ts.itemName }}
                        className={`font-medium ${item.available ? "" : "text-muted"}`}
                      >
                        {item.name}
                      </span>
                      {!item.available && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted">
                          Sold out
                        </span>
                      )}
                      {item.description && (
                        <p style={{ fontSize: ts.itemDesc }} className="text-muted mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span style={{ fontSize: ts.itemPrice }} className="font-medium tabular-nums">
                        {formatCents(item.priceCents, currency)}
                      </span>
                      {item.available && (
                        <button
                          onClick={() =>
                            item.groups.length > 0 ? setSheetItem(item) : addSimple(item)
                          }
                          className={`text-xs font-medium px-2.5 py-1 ${addBtnClass}`}
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : layout === "grid" || cs.imagePosition === "top" ? (
              <div className="grid grid-cols-2 gap-3">
                {cat.items.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-[var(--radius-card)] bg-surface overflow-hidden flex flex-col ${cardBorderClass(cs.border)} ${cardShadowClass(cs.shadow)}`}
                  >
                    <div className={`bg-paper relative ${aspectClass(cs.imageAspect)}`}>
                      {item.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.imageUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                          {cat.icon || "No photo"}
                        </div>
                      )}
                      {!item.available && (
                        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide bg-surface/90 text-muted px-1.5 py-0.5 rounded">
                          Sold out
                        </span>
                      )}
                    </div>
                    <div className="p-3 flex-1 flex flex-col">
                      <span
                        style={{ fontSize: ts.itemName }}
                        className={`font-medium ${item.available ? "" : "text-muted"}`}
                      >
                        {item.name}
                      </span>
                      <ItemBadges badges={item.badges} />
                      <p style={{ fontSize: ts.itemPrice }} className="font-medium mt-1.5 tabular-nums">
                        {formatCents(item.priceCents, currency)}
                      </p>
                      {item.available && (
                        <button
                          onClick={() =>
                            item.groups.length > 0 ? setSheetItem(item) : addSimple(item)
                          }
                          className={`mt-2 py-1.5 text-sm font-medium ${addBtnClass}`}
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-2">
                {cat.items.map((item) => (
                  <li
                    key={item.id}
                    className={`rounded-[var(--radius-card)] bg-surface p-4 flex items-start gap-3 ${cardBorderClass(cs.border)} ${cardShadowClass(cs.shadow)}`}
                  >
                    {item.imageUrl && cs.imagePosition === "left" && (
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
                        <span
                          style={{ fontSize: ts.itemName }}
                          className={`font-medium ${item.available ? "" : "text-muted"}`}
                        >
                          {item.name}
                        </span>
                        {!item.available && (
                          <span className="text-[10px] uppercase tracking-wide bg-paper text-muted px-1.5 py-0.5 rounded">
                            Sold out
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p style={{ fontSize: ts.itemDesc }} className="text-muted mt-0.5">
                          {item.description}
                        </p>
                      )}
                      <ItemBadges badges={item.badges} />
                      {item.allergens.length > 0 && (
                        <p className="text-[11px] text-muted mt-1">
                          Contains: {item.allergens.join(", ")}
                        </p>
                      )}
                      <p style={{ fontSize: ts.itemPrice }} className="font-medium mt-1 tabular-nums">
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
                        className={`shrink-0 px-4 py-2 text-sm font-medium ${addBtnClass}`}
                      >
                        Add
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {retrying && (
        <p className="mt-4 rounded-lg bg-amber-50 text-amber-800 px-3.5 py-2.5 text-sm">
          Couldn&apos;t send — retrying as soon as you&apos;re back online…
        </p>
      )}
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
              className={`w-full py-3.5 font-medium disabled:opacity-60 flex items-center justify-center gap-2 ${menuButtonClass(buttonShape, buttonFill)}`}
            >
              {(pending || retrying) && <Spinner />}
              <span>
                {retrying ? "Retrying…" : pending ? "Sending…" : submitLabel(count)}
              </span>
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
          retrying={retrying}
          error={error}
          onChangeQty={changeQty}
          onChangeNote={changeLineNote}
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
  retrying,
  error,
  onChangeQty,
  onChangeNote,
  onClose,
  onPlace,
}: {
  cart: CartLine[];
  currency: string;
  subtotal: number;
  note: string;
  setNote: (v: string) => void;
  pending: boolean;
  retrying: boolean;
  error: string | null;
  onChangeQty: (key: string, delta: number) => void;
  onChangeNote: (key: string, note: string) => void;
  onClose: () => void;
  onPlace: () => void;
}) {
  const [noteOpenFor, setNoteOpenFor] = useState<string | null>(null);
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
            {cart.map((l) => {
              const noteOpen = noteOpenFor === l.key || !!l.note;
              return (
                <li key={l.key}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{l.name}</span>
                      {l.optionLabel && (
                        <span className="block text-xs text-muted">
                          {l.optionLabel}
                        </span>
                      )}
                      {!noteOpen && (
                        <button
                          onClick={() => setNoteOpenFor(l.key)}
                          className="text-xs text-muted hover:text-ink underline mt-0.5"
                        >
                          Add a note
                        </button>
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
                  </div>
                  {noteOpen && (
                    <input
                      autoFocus={noteOpenFor === l.key}
                      value={l.note ?? ""}
                      onChange={(e) => onChangeNote(l.key, e.target.value)}
                      maxLength={140}
                      placeholder="e.g. no fries"
                      className="mt-1.5 w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-xs focus:border-pine focus:outline-none"
                    />
                  )}
                </li>
              );
            })}
          </ul>

          <div>
            <label className="text-sm text-muted block mb-1">
              Note for the whole order{" "}
              <span className="text-xs">(optional — for a specific item, use &quot;Add a note&quot; above)</span>
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

          {retrying && (
            <p className="rounded-lg bg-amber-50 text-amber-800 px-3.5 py-2.5 text-sm">
              Couldn&apos;t send — retrying as soon as you&apos;re back online…
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-danger-soft text-danger px-3.5 py-2.5 text-sm">
              {error}
            </p>
          )}

          <button
            onClick={onPlace}
            disabled={pending || cart.length === 0}
            className="w-full rounded-xl bg-pine text-[color:var(--on-accent,#fff)] py-3.5 font-medium hover:bg-pine-deep disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {(pending || retrying) && <Spinner />}
            {retrying ? "Retrying…" : pending ? "Placing order…" : "Place order"}
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
  const [note, setNote] = useState("");

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
      note: note.trim() || undefined,
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

          <div>
            <label className="text-sm text-muted mb-1.5 block">
              Special requests (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. no onion, extra spicy"
              rows={2}
              className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-pine focus:outline-none resize-none"
            />
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
