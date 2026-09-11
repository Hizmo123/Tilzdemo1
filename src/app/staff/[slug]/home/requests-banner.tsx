"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRequest } from "./actions";

type Req = {
  id: string;
  tableLabel: string;
  status: string;
  minutesAgo: number;
};

export function RequestsBanner({ slug, requests }: { slug: string; requests: Req[] }) {
  if (requests.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-amber-700 mb-2">
        Tables needing assistance ({requests.length})
      </h2>
      <div className="grid sm:grid-cols-2 gap-2">
        {requests.map((r) => (
          <RequestRow key={r.id} slug={slug} req={r} />
        ))}
      </div>
    </div>
  );
}

function RequestRow({ slug, req }: { slug: string; req: Req }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function move(to: "ACKNOWLEDGED" | "COMPLETED") {
    start(async () => {
      await updateRequest(slug, req.id, to);
      router.refresh();
    });
  }

  const waited =
    req.minutesAgo <= 0
      ? "just now"
      : req.minutesAgo < 60
        ? `${req.minutesAgo} min ago`
        : `${Math.floor(req.minutesAgo / 60)}h ago`;

  return (
    <div className="rounded-[var(--radius-card)] border border-amber-300 bg-amber-50 p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">Table {req.tableLabel} needs assistance</p>
        <p className="text-xs text-amber-700">
          {waited}
          {req.status === "ACKNOWLEDGED" ? " · on it" : ""}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        {req.status === "OPEN" && (
          <button
            disabled={pending}
            onClick={() => move("ACKNOWLEDGED")}
            className="text-xs rounded-md border border-amber-300 bg-surface px-2.5 py-1.5 disabled:opacity-50"
          >
            On it
          </button>
        )}
        <button
          disabled={pending}
          onClick={() => move("COMPLETED")}
          className="text-xs rounded-md bg-pine text-white px-3 py-1.5 hover:bg-pine-deep disabled:opacity-50"
        >
          Done
        </button>
      </div>
    </div>
  );
}
