"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addItems, cancelOrder, saveContact } from "./actions";
import { PaySheet } from "./pay-sheet";
import { CallStaff } from "./call-staff";
import { MenuDisplay } from "./menu-display";
import { MenuOrderer, type OrderCategory } from "@/components/order/menu-orderer";
import { formatCents } from "@/lib/money";
import { themeVars } from "@/lib/theme";

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
type Paid = { amountCents: number; fullyPaid: boolean; remainingAfter: number };
type Placed = { name: string; quantity: number }[];
type View = "home" | "menu" | "bill";

export function CustomerExperience({
  token,
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
  paymentTiming,
  tipEnabled,
  tipPresets,
  open,
  canOrder,
  canPay,
  orders,
  menu,
  bill,
}: {
  token: string;
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
  paymentTiming: string;
  tipEnabled: boolean;
  tipPresets: number[];
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
  const [payMode, setPayMode] = useState<"full" | "equal">("full");
  const [cancelling, startCancel] = useTransition();

  function onCancel(orderId: string) {
    startCancel(async () => {
      await cancelOrder(token, orderId);
      router.refresh();
    });
  }

  const remaining = bill ? bill.totalCents - bill.amountPaidCents : 0;
  const dark = themeMode === "dark";
  const themeStyle = themeVars({ theme, themeMode, fontTheme, brandColor });

  // Send the order, then hand a summary to the success screen. We deliberately
  // do NOT await router.refresh() before showing success — the confirmation is
  // driven by local state, so the screen appears instantly and the server data
  // re-syncs in the background for when they open their bill.
  async function submitOrder(
    lines: { menuItemId: string; quantity: number; optionIds: string[] }[],
    note?: string,
    clientRequestId?: string,
  ) {
    const res = await addItems(token, lines, note || undefined, clientRequestId);
    return res;
  }

  function handlePlaced(summary: Placed) {
    setPlaced(summary);
    router.refresh();
  }

  // Background layer: an optional full-page photo with a mode-aware scrim so the
  // surface cards and text stay legible over it.
  const Background = bgImageUrl ? (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bgImageUrl}
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
            ? "linear-gradient(180deg, rgba(8,8,10,0.72), rgba(8,8,10,0.82))"
            : "linear-gradient(180deg, rgba(255,255,255,0.66), rgba(255,255,255,0.78))",
        }}
      />
    </>
  ) : null;

  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <main
        style={themeStyle}
        className={`relative min-h-dvh text-ink ${bgImageUrl ? "" : "bg-paper"}`}
      >
        {Background}
        {children}
      </main>
    );
  }

  // ---- Order placed (success) ----
  if (placed) {
    const totalItems = placed.reduce((n, l) => n + l.quantity, 0);
    return (
      <Shell>
        <div className="max-w-sm mx-auto px-5 pt-10 pb-10 min-h-dvh flex flex-col justify-center">
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-pine-soft text-pine-deep flex items-center justify-center mx-auto mb-4 text-2xl">
              ✓
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Order placed
            </h1>
            <p className="text-muted mt-1 text-sm">
              Sent to the kitchen — {totalItems} {totalItems === 1 ? "item" : "items"}.
            </p>
            <ul className="text-left mt-5 space-y-1.5 border-t border-line pt-4">
              {placed.map((l, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span className="text-ink-soft">{l.name}</span>
                  <span className="text-muted tabular-nums">×{l.quantity}</span>
                </li>
              ))}
            </ul>
            <NotifyWhenReady token={token} />

            <p className="text-xs text-muted mt-4">
              Ordered by mistake? You can cancel it under “Your orders” until the
              kitchen starts preparing it.
            </p>
            <div className="mt-6 space-y-2">
              {paymentTiming === "before" && canPay && remaining > 0 ? (
                <button
                  onClick={() => {
                    setPlaced(null);
                    setView("bill");
                    setPayMode("full");
                    setPayOpen(true);
                  }}
                  className="w-full rounded-xl bg-pine text-[color:var(--on-accent,#fff)] py-3 font-medium hover:bg-pine-deep transition-colors"
                >
                  Pay now
                </button>
              ) : (
                <button
                  onClick={() => {
                    setPlaced(null);
                    setView("bill");
                  }}
                  className="w-full rounded-xl bg-ink text-surface py-3 font-medium hover:opacity-90 transition-opacity"
                >
                  View my bill
                </button>
              )}
              <button
                onClick={() => {
                  setPlaced(null);
                  setView("menu");
                }}
                className="w-full rounded-xl border border-line py-3 font-medium hover:border-ink/30 transition-colors"
              >
                Order more
              </button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  // ---- Paid confirmation ----
  if (paid) {
    return (
      <Shell>
        <div className="max-w-sm mx-auto px-5 pt-10 pb-10 min-h-dvh flex flex-col justify-center">
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-pine-soft text-pine-deep flex items-center justify-center mx-auto mb-4 text-2xl">
              ✓
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Payment complete
            </h1>
            <p className="text-muted mt-1">{restaurantName}</p>
            <p className="text-muted text-sm">
              {locationName} · Table {tableLabel}
            </p>
            <p className="font-display text-3xl font-semibold tracking-tight mt-5">
              {formatCents(paid.amountCents, currency)}
            </p>
            <p className="text-sm text-muted mt-1">
              {new Date().toLocaleString("en-AU")}
            </p>
            {paid.fullyPaid ? (
              <p className="text-sm text-pine-deep mt-3 font-medium">
                You&apos;re all paid up. Thanks!
              </p>
            ) : (
              <div className="mt-4 rounded-lg bg-paper p-3">
                <p className="text-sm text-muted">Remaining on this table</p>
                <p className="font-display text-xl font-semibold tracking-tight">
                  {formatCents(paid.remainingAfter, currency)}
                </p>
              </div>
            )}
            <p className="mt-6 text-[11px] uppercase tracking-wide text-amber-700 bg-amber-50 rounded-md py-2">
              Test payment — no real money moved
            </p>
            <Link
              href={`/v/${token}/receipt`}
              className="mt-4 inline-block text-sm font-medium text-pine hover:underline"
            >
              View tax invoice →
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const Header = (
    <div className="mb-6">
      {coverUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={coverUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full h-32 object-cover rounded-[var(--radius-card)] mb-4"
        />
      )}
      <div className="text-center">
        {logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logoUrl}
            alt={restaurantName}
            loading="eager"
            decoding="async"
            className="h-12 w-auto mx-auto mb-2 object-contain"
          />
        ) : (
          <p className="text-sm font-medium text-pine">Welcome to</p>
        )}
        <h1 className="font-display text-2xl font-semibold tracking-tight mt-0.5">
          {restaurantName}
        </h1>
        <p className="text-muted text-sm mt-0.5">
          {locationName} · Table {tableLabel}
        </p>
      </div>
    </div>
  );

  const Back = (
    <button
      onClick={() => setView("home")}
      className="text-sm text-muted hover:text-ink mb-4"
    >
      ← Back
    </button>
  );

  // ---- HOME ----
  if (view === "home") {
    return (
      <Shell>
        <div className="max-w-sm mx-auto px-5 pt-8 pb-10">
          {Header}

          {!open && (
            <div className="rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 p-4 mb-4 text-center">
              <p className="font-medium text-amber-800">We&apos;re closed right now</p>
              <p className="text-sm text-amber-700 mt-0.5">
                You can browse the menu — ordering opens when we do.
              </p>
            </div>
          )}

          {orders.length > 0 && (
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 mb-4">
              <h2 className="text-sm font-medium text-muted mb-2">Your orders</h2>
              <ul className="space-y-2">
                {orders.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm text-ink-soft truncate flex-1">
                      {o.orderNumber != null && (
                        <span className="text-muted font-medium">
                          #{o.orderNumber}{" "}
                        </span>
                      )}
                      {o.items.join(", ")}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {(o.status === "SUBMITTED" ||
                        o.status === "PENDING" ||
                        o.status === "AWAITING_PAYMENT") && (
                        <button
                          onClick={() => onCancel(o.id)}
                          disabled={cancelling}
                          className="text-xs text-muted hover:text-danger disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                      <OrderStatusBadge status={o.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => setView("menu")}
              className="w-full rounded-2xl bg-pine text-[color:var(--on-accent,#fff)] p-5 text-left hover:bg-pine-deep transition-colors"
            >
              <span className="block font-display text-lg font-semibold tracking-tight">
                {canOrder ? "View menu & order" : "View menu"}
              </span>
              <span className="block text-sm opacity-80 mt-0.5">
                {canOrder ? "Browse and add to your table" : "See what's on offer"}
              </span>
            </button>

            <button
              onClick={() => setView("bill")}
              className="w-full rounded-2xl border border-line bg-surface p-5 text-left hover:border-ink/30 transition-colors"
            >
              <span className="flex items-center justify-between">
                <span className="font-display text-lg font-semibold tracking-tight">
                  {canPay ? "Bill & pay" : "Your bill"}
                </span>
                {bill && remaining > 0 && (
                  <span className="text-sm font-medium tabular-nums">
                    {formatCents(remaining, currency)}
                  </span>
                )}
              </span>
              <span className="block text-sm text-muted mt-0.5">
                {bill && bill.items.length > 0
                  ? canPay
                    ? "See your bill and pay your share"
                    : "See your running bill"
                  : "Nothing on the tab yet"}
              </span>
            </button>

            <CallStaff token={token} variant="block" />
          </div>
        </div>
      </Shell>
    );
  }

  // ---- MENU ----
  if (view === "menu") {
    return (
      <Shell>
        <div className="max-w-sm mx-auto px-5 pt-6">
          {Back}
          <h1 className="font-display text-2xl font-semibold tracking-tight mb-4">
            Menu
          </h1>
          {menu.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-6 text-center text-sm text-muted">
              This restaurant hasn&apos;t published its menu yet.
            </div>
          ) : canOrder ? (
            <MenuOrderer
              menu={menu}
              currency={currency}
              reviewStep
              submitLabel={(n) => `Review order · ${n}`}
              onSubmit={submitOrder}
              onPlaced={handlePlaced}
            />
          ) : (
            <>
              <p className="text-sm text-muted text-center mb-4">
                Your server will take your order. Tap “Call staff” when you&apos;re
                ready.
              </p>
              <MenuDisplay menu={menu} currency={currency} />
            </>
          )}
        </div>
      </Shell>
    );
  }

  // ---- BILL ----
  return (
    <Shell>
      <div className="max-w-sm mx-auto px-5 pt-6 pb-10">
        {Back}
        <h1 className="font-display text-2xl font-semibold tracking-tight mb-4">
          Your bill
        </h1>

        {!bill || bill.items.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
            Nothing on the tab yet.
          </div>
        ) : (
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
            <ul className="space-y-2">
              {bill.items.map((it) => (
                <li key={it.id} className="flex justify-between text-sm gap-3">
                  <span className="min-w-0">
                    {it.quantity > 1 && (
                      <span className="text-muted">{it.quantity}× </span>
                    )}
                    {it.nameSnapshot}
                    {it.modifiers && it.modifiers.length > 0 && (
                      <span className="block text-xs text-muted">
                        {it.modifiers.map((m) => m.name).join(", ")}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums shrink-0">
                    {formatCents(it.lineTotalCents, currency)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t border-line mt-3 pt-3 flex justify-between font-medium">
              <span>Total</span>
              <span className="tabular-nums">
                {formatCents(bill.totalCents, currency)}
              </span>
            </div>
            {bill.amountPaidCents > 0 && (
              <>
                <div className="flex justify-between text-sm text-muted mt-1">
                  <span>Already paid</span>
                  <span className="tabular-nums">
                    −{formatCents(bill.amountPaidCents, currency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-medium mt-1">
                  <span>Remaining</span>
                  <span className="tabular-nums">
                    {formatCents(remaining, currency)}
                  </span>
                </div>
              </>
            )}

            {remaining > 0 && canPay && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    setPayMode("full");
                    setPayOpen(true);
                  }}
                  className="flex-1 rounded-xl bg-ink text-surface py-3 font-medium hover:opacity-90"
                >
                  Pay {formatCents(remaining, currency)}
                </button>
                <button
                  onClick={() => {
                    setPayMode("equal");
                    setPayOpen(true);
                  }}
                  className="rounded-xl border border-line px-5 py-3 font-medium hover:border-ink/30"
                >
                  Split
                </button>
              </div>
            )}
            {remaining > 0 && !canPay && (
              <p className="text-sm text-muted mt-4 text-center">
                Please pay at the counter or ask your server.
              </p>
            )}
          </div>
        )}
      </div>

      {bill && (
        <PaySheet
          token={token}
          currency={currency}
          items={bill.items}
          remainingCents={remaining}
          open={payOpen}
          initialMode={payMode}
          tipEnabled={tipEnabled}
          tipPresets={tipPresets}
          onClose={() => setPayOpen(false)}
          onPaid={(amountCents, fullyPaid) => {
            setPayOpen(false);
            setPaid({
              amountCents,
              fullyPaid,
              remainingAfter: Math.max(0, remaining - amountCents),
            });
          }}
        />
      )}
    </Shell>
  );
}

const STATUS_COPY: Record<string, { label: string; cls: string }> = {
  AWAITING_PAYMENT: { label: "Pay to send", cls: "bg-danger-soft text-danger" },
  PENDING: { label: "Awaiting approval", cls: "bg-amber-50 text-amber-700" },
  SUBMITTED: { label: "Received", cls: "bg-amber-50 text-amber-700" },
  PREPARING: { label: "Preparing", cls: "bg-blue-50 text-blue-700" },
  READY: { label: "Ready", cls: "bg-pine-soft text-pine-deep" },
  SERVED: { label: "Served", cls: "bg-paper text-muted" },
};
function OrderStatusBadge({ status }: { status: string }) {
  const s = STATUS_COPY[status] ?? STATUS_COPY.SUBMITTED;
  return (
    <span
      className={`shrink-0 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

// Optional "text me when it's ready" capture on the order-placed screen.
function NotifyWhenReady({ token }: { token: string }) {
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (saved) {
    return (
      <p className="mt-4 text-sm text-pine-deep">
        ✓ We&apos;ll text you when it&apos;s ready.
      </p>
    );
  }

  return (
    <div className="mt-5 border-t border-line pt-4 text-left">
      <label className="text-sm font-medium block mb-1">
        Text me when it&apos;s ready
      </label>
      <div className="flex gap-2">
        <input
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="04xx xxx xxx"
          className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-pine focus:outline-none"
        />
        <button
          disabled={pending || phone.trim().length < 6}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await saveContact(token, phone.trim());
              if (res && "error" in res) setError(res.error ?? "Couldn't save that number.");
              else setSaved(true);
            })
          }
          className="rounded-lg bg-ink text-surface px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "…" : "Notify me"}
        </button>
      </div>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}
