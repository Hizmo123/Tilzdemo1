"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { formatCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { AnimatedMoney, AnimatedInt } from "@/components/ui/animated-number";
import { SPRING, SPRING_PRESS, SPRING_SOFT, easeOut, haptic } from "@/components/ui/motion";
import { CategoryNav, sectionId, useScrollSpy } from "./category-tabs";
import { ItemBadges, PhotoFallback } from "@/app/v/[token]/menu-display";
import {
  resolveCardStyle,
  resolveTypeScale,
  aspectClass,
  cardBorderClass,
  cardShadowClass,
  dividerClass,
  sectionHeaderClass,
  menuButtonClass,
  MENU_HEADLINE_FONT,
  type CardStyle,
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

type TypeSize = ReturnType<typeof resolveTypeScale>;

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
  ) => Promise<{ error?: string } | { ok: true; skippedMenuItemIds?: string[] }>;
  reviewStep?: boolean;
  // skippedCount: items in the cart that the server silently dropped (sold
  // out/deleted between adding to cart and sending) — lets the success
  // screen say so instead of claiming every tapped item reached the
  // kitchen.
  onPlaced?: (summary: { name: string; quantity: number }[], skippedCount?: number) => void;
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
  const isGrid = layout === "grid";
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sheetItem, setSheetItem] = useState<OrderMenuItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  // Bumped every time something lands in the cart, so the cart bar can
  // pulse in acknowledgement.
  const [bump, setBump] = useState(0);
  // Stable idempotency key for the current order. Kept across retries — and
  // across an offline gap — so a resend of a failed submit can never create a
  // duplicate on the server, no matter how many times the client retries it.
  const submitKeyRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = persistKey ? `tillz_cart_${persistKey}` : null;
  const hydratedRef = useRef(false);

  const ids = useMemo(() => menu.map((c) => c.id), [menu]);
  const { activeId, scrollTo } = useScrollSpy(ids);

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

  // Units of an item in the cart with NO options — what the inline stepper
  // on a simple item's card shows and edits.
  const simpleQty = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of cart) if (l.optionIds.length === 0) m.set(l.menuItemId, (m.get(l.menuItemId) ?? 0) + l.quantity);
    return m;
  }, [cart]);
  // Any units at all (configured or not) — the badge on a modifier item's "+".
  const anyQty = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of cart) m.set(l.menuItemId, (m.get(l.menuItemId) ?? 0) + l.quantity);
    return m;
  }, [cart]);

  function added() {
    setBump((b) => b + 1);
    haptic();
  }

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
    added();
  }

  function removeSimple(item: OrderMenuItem) {
    setCart((c) =>
      c
        .map((l) =>
          l.menuItemId === item.id && l.optionIds.length === 0 ? { ...l, quantity: l.quantity - 1 } : l,
        )
        .filter((l) => l.quantity > 0),
    );
    haptic(6);
  }

  function addConfigured(line: CartLine) {
    setCart((c) => [...c, line]);
    added();
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

  // Fired by the cart bar. With reviewStep, open the review sheet; without
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
      // lines and summary are built together from the same cart, same
      // order — zip them by index to drop whichever lines the server
      // actually skipped instead of showing a false full-cart success.
      const skipped = res && "skippedMenuItemIds" in res ? res.skippedMenuItemIds : undefined;
      const placedSummary =
        skipped && skipped.length
          ? summary.filter((_, i) => !skipped.includes(lines[i].menuItemId))
          : summary;
      onPlaced?.(placedSummary, skipped?.length ?? 0);
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

  const topImages = cs.imagePosition === "top";

  return (
    <div className="pb-32">
      <CategoryNav categories={menu} activeId={activeId} onSelect={scrollTo} />

      <div className={`pt-4 ${isMagazine ? "space-y-12" : "space-y-9"}`}>
        {menu.map((cat) => (
          <section key={cat.id} id={sectionId(cat.id)} className="scroll-mt-28">
            <h3
              style={{ fontSize: isMagazine ? `calc(${ts.categoryHeader} + 6px)` : ts.categoryHeader }}
              className={`${MENU_HEADLINE_FONT} font-semibold tracking-tight mb-3.5 flex items-center gap-2 ${sectionHeaderClass(sectionHeaderStyle)}`}
            >
              {cat.icon && <span aria-hidden>{cat.icon}</span>}
              {cat.name}
            </h3>

            {isMinimal ? (
              <div className={dividerClass(cs.divider) ? "divide-y divide-line" : ""}>
                {cat.items.map((item) => (
                  <MinimalRow
                    key={item.id}
                    item={item}
                    ts={ts}
                    currency={currency}
                    simpleQty={simpleQty.get(item.id) ?? 0}
                    anyQty={anyQty.get(item.id) ?? 0}
                    addBtnClass={addBtnClass}
                    onOpen={() => setSheetItem(item)}
                    onAdd={() => (item.groups.length > 0 ? setSheetItem(item) : addSimple(item))}
                    onRemove={() => removeSimple(item)}
                  />
                ))}
              </div>
            ) : (
              <div
                className={
                  isGrid || topImages
                    ? "grid grid-cols-2 md:grid-cols-3 gap-3"
                    : `grid gap-3 md:grid-cols-2 ${isMagazine ? "sm:gap-4" : ""}`
                }
              >
                {cat.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    cs={cs}
                    ts={ts}
                    currency={currency}
                    simpleQty={simpleQty.get(item.id) ?? 0}
                    anyQty={anyQty.get(item.id) ?? 0}
                    addBtnClass={addBtnClass}
                    onOpen={() => setSheetItem(item)}
                    onAdd={() => (item.groups.length > 0 ? setSheetItem(item) : addSimple(item))}
                    onRemove={() => removeSimple(item)}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {retrying && (
        <p className="mt-4 rounded-[var(--radius-md)] bg-warn-soft text-warn px-3.5 py-2.5 text-sm">
          Couldn&apos;t send — retrying as soon as you&apos;re back online…
        </p>
      )}
      {error && !reviewOpen && (
        <p className="mt-4 rounded-[var(--radius-md)] bg-danger-soft text-danger px-3.5 py-2.5 text-sm">
          {error}
        </p>
      )}

      {/* Floating cart bar — springs in when the first item lands. */}
      <AnimatePresence>
        {count > 0 && (
          <motion.div
            key="cartbar"
            initial={{ y: 96, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 96, opacity: 0, transition: easeOut(0.2) }}
            transition={SPRING}
            className="fixed bottom-0 inset-x-0 z-30 px-4 pb-safe pt-3 pointer-events-none"
          >
            <motion.div
              key={bump}
              initial={bump > 0 ? { scale: 0.97 } : false}
              animate={{ scale: 1 }}
              transition={SPRING}
              className="max-w-md md:max-w-lg mx-auto pointer-events-auto"
            >
              <Button
                variant="primary"
                size="lg"
                full
                onClick={primaryAction}
                disabled={pending}
                loading={pending || retrying}
                className="justify-between px-4"
              >
                <span className="flex items-center gap-3">
                  <span className="min-w-7 h-7 px-2 rounded-pill bg-white/20 text-on-accent flex items-center justify-center text-sm font-semibold tabular">
                    <AnimatedInt value={count} />
                  </span>
                  <span>{retrying ? "Retrying…" : pending ? "Sending…" : submitLabel(count)}</span>
                </span>
                <AnimatedMoney cents={subtotal} currency={currency} className={`${MENU_HEADLINE_FONT} text-lg`} />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ItemSheet
        item={sheetItem}
        currency={currency}
        onClose={() => setSheetItem(null)}
        onConfirm={(line) => {
          addConfigured(line);
          setSheetItem(null);
        }}
      />

      <ReviewSheet
        open={reviewOpen}
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
    </div>
  );
}

// ---- Add control: "+" that morphs into a stepper once the item's in the
// cart. Items with modifiers keep the "+" (each add is a fresh configuration
// via the sheet) and show a count badge instead.
function AddControl({
  item,
  simpleQty,
  anyQty,
  addBtnClass,
  onAdd,
  onRemove,
  size = "md",
}: {
  item: OrderMenuItem;
  simpleQty: number;
  anyQty: number;
  addBtnClass: string;
  onAdd: () => void;
  onRemove: () => void;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-9 min-w-9" : "h-10 min-w-10";
  if (!item.available) return null;
  const hasGroups = item.groups.length > 0;

  if (!hasGroups && simpleQty > 0) {
    return (
      <motion.div
        layout
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING}
        className={`inline-flex items-center rounded-pill bg-pine text-on-accent shadow-accent ${dim}`}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          transition={SPRING_PRESS}
          onClick={onRemove}
          aria-label={`Remove one ${item.name}`}
          className={`${dim} flex items-center justify-center text-lg leading-none`}
        >
          −
        </motion.button>
        <span className="min-w-5 text-center text-sm font-semibold tabular">
          <AnimatedInt value={simpleQty} />
        </span>
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          transition={SPRING_PRESS}
          onClick={onAdd}
          aria-label={`Add one more ${item.name}`}
          className={`${dim} flex items-center justify-center text-lg leading-none`}
        >
          +
        </motion.button>
      </motion.div>
    );
  }

  return (
    <motion.button
      layout
      type="button"
      whileTap={{ scale: 0.85 }}
      transition={SPRING_PRESS}
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
      }}
      aria-label={hasGroups ? `Choose options for ${item.name}` : `Add ${item.name}`}
      className={`relative ${dim} w-auto px-0 aspect-square flex items-center justify-center text-xl leading-none font-medium ${addBtnClass}`}
    >
      +
      {hasGroups && anyQty > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-pill bg-ink text-surface text-[11px] font-semibold flex items-center justify-center tabular">
          {anyQty}
        </span>
      )}
    </motion.button>
  );
}

type CardProps = {
  item: OrderMenuItem;
  ts: TypeSize;
  currency: string;
  simpleQty: number;
  anyQty: number;
  addBtnClass: string;
  onOpen: () => void;
  onAdd: () => void;
  onRemove: () => void;
};

function ItemCard({ item, cs, ...p }: CardProps & { cs: CardStyle }) {
  const { ts, currency } = p;
  const showImage = cs.imagePosition !== "none";
  const top = cs.imagePosition === "top";

  const imageEl = showImage ? (
    <div
      className={`relative overflow-hidden shrink-0 bg-surface-2 ${
        top ? `w-full ${aspectClass(cs.imageAspect)}` : "w-[72px] h-[72px] rounded-[var(--radius-md)]"
      }`}
    >
      {item.imageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 w-full h-full object-cover ${item.available ? "" : "grayscale opacity-60"}`}
        />
      ) : (
        <PhotoFallback name={item.name} />
      )}
      {!item.available && top && (
        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide bg-surface/90 text-muted px-2 py-0.5 rounded-pill">
          Sold out
        </span>
      )}
    </div>
  ) : null;

  const textEl = (
    <div className="flex-1 min-w-0">
      <span style={{ fontSize: ts.itemName }} className={`${MENU_HEADLINE_FONT} block font-semibold leading-snug ${item.available ? "" : "text-muted"}`}>
        {item.name}
      </span>
      {item.description && (
        <p style={{ fontSize: ts.itemDesc }} className="text-muted mt-0.5 line-clamp-2">
          {item.description}
        </p>
      )}
      {!item.available && !top && (
        <span className="inline-block mt-1 text-[10px] uppercase tracking-wide bg-surface-2 text-muted px-2 py-0.5 rounded-pill">
          Sold out
        </span>
      )}
      <ItemBadges badges={item.badges} allergens={item.allergens} />
    </div>
  );

  const priceEl = (
    <span style={{ fontSize: ts.itemPrice }} className={`${MENU_HEADLINE_FONT} font-semibold tabular`}>
      {formatCents(item.priceCents, currency)}
    </span>
  );

  const shell = `rounded-[var(--radius-card)] bg-surface text-left ${cardBorderClass(cs.border)} ${cardShadowClass(cs.shadow)} ${
    item.available ? "cursor-pointer active:scale-[0.99] transition-transform duration-[var(--dur-fast)]" : ""
  }`;

  if (top) {
    return (
      <div role="button" tabIndex={0} onClick={p.onOpen} onKeyDown={(e) => e.key === "Enter" && p.onOpen()} className={`${shell} overflow-hidden flex flex-col`}>
        {imageEl}
        <div className="p-3.5 flex-1 flex flex-col">
          {textEl}
          <div className="mt-3 flex items-center justify-between gap-2">
            {priceEl}
            <AddControl item={item} simpleQty={p.simpleQty} anyQty={p.anyQty} addBtnClass={p.addBtnClass} onAdd={p.onAdd} onRemove={p.onRemove} size="sm" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="button" tabIndex={0} onClick={p.onOpen} onKeyDown={(e) => e.key === "Enter" && p.onOpen()} className={`${shell} p-3.5 flex items-start gap-3.5`}>
      {imageEl}
      <div className="flex-1 min-w-0 flex flex-col">
        {textEl}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          {priceEl}
          <AddControl item={item} simpleQty={p.simpleQty} anyQty={p.anyQty} addBtnClass={p.addBtnClass} onAdd={p.onAdd} onRemove={p.onRemove} />
        </div>
      </div>
    </div>
  );
}

function MinimalRow({ item, ...p }: CardProps) {
  const { ts, currency } = p;
  return (
    <div role="button" tabIndex={0} onClick={p.onOpen} onKeyDown={(e) => e.key === "Enter" && p.onOpen()} className="flex items-center justify-between gap-3 py-3 cursor-pointer">
      <div className="min-w-0 flex-1">
        <span style={{ fontSize: ts.itemName }} className={`${MENU_HEADLINE_FONT} font-semibold ${item.available ? "" : "text-muted"}`}>
          {item.name}
        </span>
        {!item.available && <span className="ml-2 text-[10px] uppercase tracking-wide text-muted">Sold out</span>}
        {item.description && (
          <p style={{ fontSize: ts.itemDesc }} className="text-muted mt-0.5">
            {item.description}
          </p>
        )}
      </div>
      <span style={{ fontSize: ts.itemPrice }} className={`${MENU_HEADLINE_FONT} font-semibold tabular shrink-0`}>
        {formatCents(item.priceCents, currency)}
      </span>
      <AddControl item={item} simpleQty={p.simpleQty} anyQty={p.anyQty} addBtnClass={p.addBtnClass} onAdd={p.onAdd} onRemove={p.onRemove} size="sm" />
    </div>
  );
}

// ---- Item sheet: photo, story, modifiers as pills, live price, add. ---------
function ItemSheet({
  item,
  currency,
  onClose,
  onConfirm,
}: {
  item: OrderMenuItem | null;
  currency: string;
  onClose: () => void;
  onConfirm: (line: CartLine) => void;
}) {
  return (
    <Sheet open={!!item} onClose={onClose} size="lg">
      {item && <ItemSheetBody key={item.id} item={item} currency={currency} onConfirm={onConfirm} />}
    </Sheet>
  );
}

function ItemSheetBody({
  item,
  currency,
  onConfirm,
}: {
  item: OrderMenuItem;
  currency: string;
  onConfirm: (line: CartLine) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const reduced = useReducedMotion();

  // Required groups the customer hasn't filled yet, surfaced at the moment
  // Add is blocked — NOT computed reactively on every render, so a group
  // that's still empty doesn't show as an error before they've even tried
  // to submit (see point 5: the "Required" chip is the only always-on cue).
  const [missingGroupIds, setMissingGroupIds] = useState<Set<string>>(new Set());
  // Bumped on every blocked attempt so the shake animations (group + button)
  // retrigger even if the same groups are still missing.
  const [attempt, setAttempt] = useState(0);
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function toggle(group: OrderGroup, optionId: string) {
    haptic(6);
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
      // A group that now satisfies its requirement clears its own
      // highlight/message immediately — no need to wait for another Add tap.
      if (group.required && next.length > 0 && missingGroupIds.has(group.id)) {
        setMissingGroupIds((prev) => {
          const nextSet = new Set(prev);
          nextSet.delete(group.id);
          return nextSet;
        });
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
    if (!item.available) return;
    const missing = item.groups.filter((g) => g.required && (selected[g.id] ?? []).length < 1);
    if (missing.length > 0) {
      setMissingGroupIds(new Set(missing.map((g) => g.id)));
      setAttempt((a) => a + 1);
      haptic([20, 40, 20]);
      const firstEl = groupRefs.current[missing[0].id];
      firstEl?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      return;
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

  const missingGroups = item.groups.filter((g) => missingGroupIds.has(g.id));
  const missingMessage =
    missingGroups.length === 0
      ? null
      : missingGroups.length === 1
        ? `Choose ${missingGroups[0].name} to continue`
        : `Choose ${missingGroups.length} options to continue`;
  const shakeAnim = reduced ? undefined : { x: [0, -6, 6, -4, 4, 0] };

  return (
    <div className="-mx-5 -mt-4">
      <div className="relative aspect-[4/3] bg-surface-2 overflow-hidden">
        {item.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <PhotoFallback name={item.name} />
        )}
      </div>

      <div className="px-5 pt-4 pb-32 space-y-5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className={`${MENU_HEADLINE_FONT} text-display-sm font-semibold`}>{item.name}</h2>
            <span className={`${MENU_HEADLINE_FONT} text-lg font-semibold tabular shrink-0`}>
              {formatCents(item.priceCents, currency)}
            </span>
          </div>
          {item.description && <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">{item.description}</p>}
          <ItemBadges badges={item.badges} allergens={item.allergens} />
        </div>

        {item.groups.map((g) => {
          const missing = missingGroupIds.has(g.id);
          return (
            <div
              key={g.id}
              ref={(el) => {
                groupRefs.current[g.id] = el;
              }}
              className={`rounded-[var(--radius-md)] transition-colors duration-[var(--dur-fast)] -mx-3 p-3 ${
                missing ? "bg-danger-soft ring-2 ring-danger/50" : ""
              }`}
            >
              {/* Keyed on `attempt` (not just `missing`) so tapping Add a
                  second time with the SAME group still unfilled replays the
                  shake — a plain animate-prop change wouldn't re-fire since
                  `missing` itself doesn't flip in that case. */}
              <motion.div
                key={missing ? attempt : "settled"}
                animate={missing ? shakeAnim : undefined}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="font-semibold text-sm">{g.name}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {g.required ? (
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide rounded-pill px-2 py-0.5 ${
                          missing ? "bg-danger text-white" : "bg-surface-2 text-ink-soft"
                        }`}
                      >
                        Required
                      </span>
                    ) : (
                      <span className="text-xs text-muted">Optional</span>
                    )}
                    {g.maxSelect > 1 && <span className="text-xs text-muted">up to {g.maxSelect}</span>}
                  </span>
                </div>
                {missing && (
                  <p className="text-xs font-medium text-danger mb-2">Choose {g.name.toLowerCase()}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {g.options.map((o) => {
                    const on = (selected[g.id] ?? []).includes(o.id);
                    return (
                      <motion.button
                        key={o.id}
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        transition={SPRING_PRESS}
                        aria-pressed={on}
                        onClick={() => toggle(g, o.id)}
                        className={`h-10 px-3.5 rounded-pill text-sm font-medium inline-flex items-center gap-2 transition-[background-color,color,box-shadow] duration-[var(--dur-fast)] ${
                          on ? "bg-pine text-on-accent shadow-accent" : "bg-surface border border-line text-ink-soft hover:border-line-strong"
                        }`}
                      >
                        {o.name}
                        {o.priceDeltaCents > 0 && (
                          <span className={`tabular ${on ? "opacity-85" : "text-muted"}`}>+{formatCents(o.priceDeltaCents, currency)}</span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          );
        })}

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Quantity</span>
          <div className="inline-flex items-center rounded-pill border border-line bg-surface h-11">
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-11 h-11 flex items-center justify-center text-lg leading-none"
              aria-label="Decrease quantity"
            >
              −
            </motion.button>
            <span className="w-6 text-center text-sm font-semibold tabular">
              <AnimatedInt value={quantity} />
            </span>
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              className="w-11 h-11 flex items-center justify-center text-lg leading-none"
              aria-label="Increase quantity"
            >
              +
            </motion.button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5">
            Special requests <span className="text-muted font-normal">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. no onion, extra spicy"
            rows={2}
            maxLength={140}
            className="w-full rounded-[var(--radius-md)] border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-pine focus:outline-none resize-none"
          />
        </div>

      </div>

      {/* Sticky CTA inside the sheet so it's always reachable — this is the
          ALWAYS-VISIBLE cue on a blocked Add: the customer sees why nothing
          happened here even before the scroll-to-group above lands. */}
      <div className="sticky bottom-0 inset-x-0 px-5 pt-3 pb-safe glass border-x-0 border-b-0">
        {missingMessage && (
          <motion.p
            key={attempt}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="text-sm font-medium text-danger text-center mb-2"
          >
            {missingMessage}
          </motion.p>
        )}
        <motion.div key={`btn-${attempt}`} animate={missingMessage ? shakeAnim : undefined} transition={{ duration: 0.4 }}>
          <Button variant="primary" size="lg" full onClick={confirm} disabled={!item.available} className="justify-between">
            <span>{item.available ? "Add to order" : "Sold out"}</span>
            <AnimatedMoney cents={unit * quantity} currency={currency} className={`${MENU_HEADLINE_FONT} text-lg`} />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

// ---- Review-and-confirm: last look, adjust, note for the kitchen, place. ---
function ReviewSheet({
  open,
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
  open: boolean;
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
    <Sheet
      open={open}
      onClose={onClose}
      title="Review your order"
      footer={
        <div className="space-y-2">
          {retrying && (
            <p className="rounded-[var(--radius-md)] bg-warn-soft text-warn px-3.5 py-2.5 text-sm">
              Couldn&apos;t send — retrying as soon as you&apos;re back online…
            </p>
          )}
          {error && (
            <motion.p key={error} animate={{ x: [0, -6, 6, -4, 4, 0] }} transition={{ duration: 0.4 }} className="rounded-[var(--radius-md)] bg-danger-soft text-danger px-3.5 py-2.5 text-sm">
              {error}
            </motion.p>
          )}
          <Button variant="primary" size="lg" full onClick={onPlace} disabled={pending || cart.length === 0} loading={pending || retrying} className="justify-between">
            <span>{retrying ? "Retrying…" : pending ? "Placing order…" : "Place order"}</span>
            <AnimatedMoney cents={subtotal} currency={currency} className={`${MENU_HEADLINE_FONT} text-lg`} />
          </Button>
        </div>
      }
    >
      <ul className="divide-y divide-line">
        <AnimatePresence initial={false}>
          {cart.map((l) => {
            const noteOpen = noteOpenFor === l.key || !!l.note;
            return (
              <motion.li
                key={l.key}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -24, transition: easeOut(0.18) }}
                transition={SPRING_SOFT}
                className="py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold">{l.name}</span>
                    {l.optionLabel && <span className="block text-xs text-muted">{l.optionLabel}</span>}
                    {!noteOpen && (
                      <button type="button" onClick={() => setNoteOpenFor(l.key)} className="text-xs text-muted hover:text-ink underline underline-offset-2 mt-0.5">
                        Add a note
                      </button>
                    )}
                  </div>
                  <span className="text-sm tabular text-ink-soft shrink-0">{formatCents(l.unitCents * l.quantity, currency)}</span>
                  <div className="inline-flex items-center rounded-pill border border-line bg-surface h-9 shrink-0">
                    <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => onChangeQty(l.key, -1)} className="w-9 h-9 flex items-center justify-center leading-none" aria-label={`Remove one ${l.name}`}>
                      −
                    </motion.button>
                    <span className="w-5 text-center text-sm font-semibold tabular">{l.quantity}</span>
                    <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => onChangeQty(l.key, 1)} className="w-9 h-9 flex items-center justify-center leading-none" aria-label={`Add one more ${l.name}`}>
                      +
                    </motion.button>
                  </div>
                </div>
                {noteOpen && (
                  <input
                    autoFocus={noteOpenFor === l.key}
                    value={l.note ?? ""}
                    onChange={(e) => onChangeNote(l.key, e.target.value)}
                    maxLength={140}
                    placeholder="e.g. no fries"
                    className="mt-2 w-full rounded-[var(--radius-sm)] border border-line bg-surface-2 px-3 py-2 text-xs focus:border-pine focus:outline-none"
                  />
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <div className="mt-4">
        <label className="text-sm font-medium block mb-1.5">
          Note for the whole order{" "}
          <span className="text-xs text-muted font-normal">(optional — for one item, use &quot;Add a note&quot; above)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="e.g. no onion, allergy to nuts"
          className="w-full rounded-[var(--radius-md)] border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-pine focus:outline-none resize-none"
        />
      </div>
    </Sheet>
  );
}
