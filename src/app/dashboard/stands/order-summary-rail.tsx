"use client";

import Link from "next/link";
import { AnimatedMoney } from "@/components/ui/animated-number";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/field";
import { formatCents } from "@/lib/money";
import { TypeChip, type ProductRow } from "./steps/types";

const CURRENCY = "AUD";

export type SummaryProps = {
  product: ProductRow | null;
  count: number;
  // "Dark · “Harbour Kitchen”" — only when the product has a card insert.
  cardLine: string | null;
  artworkName: string | null;
  totalCents: number;
  // Why the CTA is disabled, in one line; null when the order can be placed.
  blocker: string | null;
  error?: string;
  success?: boolean;
};

// The order summary. From lg up it's the sticky right rail and carries the
// CTA; below lg the same details sit in normal flow (showCta=false) and
// OrderBottomBar provides the CTA pinned to the bottom of the screen.
export function OrderSummary({
  product,
  count,
  cardLine,
  artworkName,
  totalCents,
  blocker,
  error,
  success,
  showCta,
}: SummaryProps & { showCta: boolean }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface shadow-rest p-5 space-y-4">
      <h2 className="font-display text-lg font-semibold tracking-tight">Your order</h2>

      {product ? (
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-[var(--radius-sm)] overflow-hidden bg-paper border border-line shrink-0 flex items-center justify-center">
            {product.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] text-muted">No photo</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{product.title}</span>
              <TypeChip type={product.type} />
            </div>
            <p className="text-xs text-muted mt-0.5">{formatCents(product.priceCents, CURRENCY)} each</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Choose a product to get started.</p>
      )}

      <dl className="text-sm space-y-2 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">
            {product ? (
              <>
                <span className="tabular-nums">{count}</span> × {product.title}
              </>
            ) : (
              "Stands"
            )}
          </dt>
          <dd className="tabular-nums">{formatCents(product ? product.priceCents * count : 0, CURRENCY)}</dd>
        </div>
        {cardLine && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">Card design</dt>
            <dd className="text-right truncate">{cardLine}</dd>
          </div>
        )}
        {artworkName && (
          <div className="flex items-baseline justify-between gap-3 min-w-0">
            <dt className="text-muted shrink-0">Custom artwork</dt>
            <dd className="text-right truncate">{artworkName}</dd>
          </div>
        )}
      </dl>

      <div className="flex items-baseline justify-between gap-3 border-t border-line pt-4">
        <span className="font-medium">Total</span>
        <AnimatedMoney cents={totalCents} currency={CURRENCY} className="font-display text-2xl font-semibold tracking-tight" />
      </div>

      {showCta && (
        <div className="space-y-2">
          <PlaceOrderButton totalCents={totalCents} blocker={blocker} />
          <SmallPrint />
          <OrderMessages error={error} success={success} />
        </div>
      )}
    </div>
  );
}

// Below lg: total + CTA pinned to the bottom of the viewport while the form
// is on screen — same sticky-footer recipe as the customer item sheet
// (components/order/menu-orderer.tsx), glass over the page.
export function OrderBottomBar({
  totalCents,
  blocker,
  error,
  success,
}: Pick<SummaryProps, "totalCents" | "blocker" | "error" | "success">) {
  return (
    <div className="lg:hidden sticky bottom-0 inset-x-0 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 pt-3 pb-safe glass border-x-0 border-b-0 space-y-2">
      <OrderMessages error={error} success={success} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Total</p>
          <AnimatedMoney cents={totalCents} currency={CURRENCY} className="font-display text-xl font-semibold tracking-tight" />
        </div>
        <div className="flex-1 max-w-xs">
          <PlaceOrderButton totalCents={totalCents} blocker={blocker} compact />
        </div>
      </div>
    </div>
  );
}

function PlaceOrderButton({ totalCents, blocker, compact = false }: { totalCents: number; blocker: string | null; compact?: boolean }) {
  return (
    <div>
      <SubmitButton pendingLabel="Placing order…" disabled={blocker !== null} size={compact ? "md" : "lg"}>
        Place order · {formatCents(totalCents, CURRENCY)}
      </SubmitButton>
      {blocker && (
        <p className={`text-xs text-muted mt-1.5 ${compact ? "text-right" : "text-center"}`} aria-live="polite">
          {blocker}
        </p>
      )}
      {!compact && (
        <p className="text-xs text-muted mt-1.5 text-center">
          By placing this order you agree to our{" "}
          <Link href="/terms" className="hover:text-ink underline underline-offset-2">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="hover:text-ink underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function SmallPrint() {
  return (
    <p className="text-xs text-muted text-center">
      Charged now · printed within a few days · shipped to your address.
    </p>
  );
}

function OrderMessages({ error, success }: { error?: string; success?: boolean }) {
  if (error) return <FormMessage tone="error">{error}</FormMessage>;
  if (success) return <FormMessage tone="info">Order placed — we&apos;ll ship it soon.</FormMessage>;
  return null;
}
