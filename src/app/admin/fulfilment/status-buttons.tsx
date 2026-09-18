"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markOrderPrinted, markOrderShipped } from "./actions";

export function StatusButtons({
  orderId,
  status,
}: {
  orderId: string;
  status: "PENDING_PAYMENT" | "PAID" | "PRINTED" | "SHIPPED";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ error?: string; ok?: boolean }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {status === "PAID" && (
        <button
          disabled={pending}
          onClick={() => run(() => markOrderPrinted(orderId))}
          className="text-xs rounded-md border border-line px-2.5 py-1.5 hover:border-ink/30 disabled:opacity-50"
        >
          Mark printed
        </button>
      )}
      {status === "PRINTED" && (
        <button
          disabled={pending}
          onClick={() => run(() => markOrderShipped(orderId))}
          className="text-xs rounded-md bg-pine text-white px-2.5 py-1.5 hover:bg-pine-deep disabled:opacity-50"
        >
          Mark shipped
        </button>
      )}
      {status === "SHIPPED" && (
        <span className="text-xs text-muted">Shipped — awaiting venue activation</span>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
