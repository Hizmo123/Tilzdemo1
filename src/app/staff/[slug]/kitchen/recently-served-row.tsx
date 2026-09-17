"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refireTicketItems } from "./actions";
import { RecallButton } from "./recall-button";

type ServedOrder = {
  id: string;
  orderNumber: number | null;
  tableLabel: string;
  items: { id: string; name: string; quantity: number }[];
};

// A recently-served ticket with two distinct recovery actions:
//  - Recall (existing): undo an accidental bump — the SAME ticket comes back
//    to PREPARING, for when nothing actually needs re-cooking.
//  - Re-fire (new, per item): a plate was dropped or sent back and genuinely
//    needs re-cooking. Creates a new, clearly-marked ticket for just that
//    item — see refireItems in lib/bills.ts for why the guest is never
//    charged twice.
export function RecentlyServedRow({ slug, order }: { slug: string; order: ServedOrder }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [refiredIds, setRefiredIds] = useState<Set<string>>(new Set());

  function refire(billItemId: string, name: string) {
    setError(null);
    start(async () => {
      const res = await refireTicketItems(slug, [billItemId], `Re-fire: ${name}`);
      if (res && "error" in res && res.error) setError(res.error);
      else {
        setRefiredIds((s) => new Set(s).add(billItemId));
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted truncate">
          {order.orderNumber != null && (
            <span className="font-medium text-ink-soft">#{order.orderNumber} </span>
          )}
          {order.tableLabel}
        </span>
        <RecallButton slug={slug} orderId={order.id} />
      </div>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {order.items.map((it) => {
          const done = refiredIds.has(it.id);
          return (
            <button
              key={it.id}
              disabled={pending || done}
              onClick={() => refire(it.id, it.name)}
              title="Re-fire — needs re-cooking (dropped, sent back)"
              className={`text-[11px] rounded-md border px-2 py-1 transition-colors disabled:opacity-50 ${
                done
                  ? "border-pine bg-pine-soft text-pine-deep"
                  : "border-line text-muted hover:border-danger/40 hover:text-danger"
              }`}
            >
              {done ? "↻ Re-fired" : `↻ ${it.quantity}× ${it.name}`}
            </button>
          );
        })}
      </div>
      {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
    </div>
  );
}
