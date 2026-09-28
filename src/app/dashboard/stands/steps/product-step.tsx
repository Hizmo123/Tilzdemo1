"use client";

import { formatCents } from "@/lib/money";
import { TypeChip, type ProductRow } from "./types";

// First sentence or two of the admin-written description, as spec lines.
export function specLines(description: string, max = 2): string[] {
  return description
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function ProductStep({
  products,
  selectedId,
  onSelect,
}: {
  products: ProductRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Product" className="grid sm:grid-cols-2 gap-4">
      {products.map((p) => {
        const selected = p.id === selectedId;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(p.id)}
            className={`text-left rounded-[var(--radius-card)] border p-3 transition-[border-color,background-color,box-shadow] duration-[var(--dur-fast)] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-pine/20 ${
              selected
                ? "border-pine bg-pine-tint shadow-accent"
                : "border-line hover:border-line-strong hover:shadow-raised"
            }`}
          >
            <div className="aspect-[4/3] rounded-[var(--radius-md)] overflow-hidden bg-paper border border-line flex items-center justify-center">
              {p.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-muted">No photo yet</span>
              )}
            </div>

            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <span className="font-medium text-ink">{p.title}</span>
                <TypeChip type={p.type} />
              </div>
              <span className="font-display text-lg font-semibold tracking-tight text-ink shrink-0">
                {formatCents(p.priceCents)}
              </span>
            </div>

            <ul className="mt-2 space-y-1 text-xs text-muted">
              {specLines(p.description).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            <p
              className={`mt-3 inline-flex items-center gap-1.5 text-xs font-medium rounded-pill px-2.5 py-1 ${
                p.hasCardInsert ? "bg-pine-soft text-pine-deep" : "bg-surface-2 text-ink-soft"
              }`}
            >
              {p.hasCardInsert ? (
                <>
                  <CardIcon />
                  Printed card insert — you pick the design
                </>
              ) : (
                <>
                  <QrIcon />
                  QR printed on the stand itself
                </>
              )}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="4" y="2.5" width="12" height="15" rx="1.5" />
      <rect x="7" y="6" width="6" height="6" rx="0.8" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="3" width="5.5" height="5.5" rx="0.8" />
      <rect x="11.5" y="3" width="5.5" height="5.5" rx="0.8" />
      <rect x="3" y="11.5" width="5.5" height="5.5" rx="0.8" />
      <path d="M11.5 11.5h2.5v2.5M17 11.5v5.5h-5.5" />
    </svg>
  );
}
