"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { recallTicket } from "./actions";

// Brings a recently-served ticket back onto the board.
export function RecallButton({ slug, orderId }: { slug: string; orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          await recallTicket(slug, orderId);
          router.refresh();
        })
      }
      className="text-xs rounded-md border border-line px-2.5 py-1 hover:border-ink/30 disabled:opacity-50"
    >
      {pending ? "…" : "Recall"}
    </button>
  );
}
