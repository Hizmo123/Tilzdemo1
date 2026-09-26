"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveOrderDesign, rejectOrderDesign } from "./actions";

type DesignStatus = "NONE" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

const STATUS_STYLE: Record<DesignStatus, string> = {
  NONE: "bg-paper text-muted",
  PENDING_REVIEW: "bg-warn-soft text-warn",
  APPROVED: "bg-success-soft text-success",
  REJECTED: "bg-danger-soft text-danger",
};

const STATUS_LABEL: Record<DesignStatus, string> = {
  NONE: "No design",
  PENDING_REVIEW: "Design: pending review",
  APPROVED: "Design: approved",
  REJECTED: "Design: rejected",
};

export function DesignStatusBadge({ status }: { status: DesignStatus }) {
  return (
    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--radius-xs)] ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// Image preview inline; anything else (PDF, SVG treated as a download rather
// than rendered inline to keep this simple) is a plain link — no inline PDF
// rendering, per the task's own scope.
export function DesignPreview({
  url,
  fileName,
}: {
  url: string;
  fileName: string | null;
}) {
  const isImage = /\.(png|jpe?g)$/i.test(url);
  return (
    <div className="flex items-center gap-3">
      {isImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt="" className="w-16 h-16 rounded-[var(--radius-sm)] object-cover border border-line shrink-0" />
      ) : (
        <div className="w-16 h-16 rounded-[var(--radius-sm)] bg-paper border border-line shrink-0 flex items-center justify-center text-[10px] text-muted">
          FILE
        </div>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-pine hover:underline truncate"
      >
        {fileName ?? "View design"}
      </a>
    </div>
  );
}

export function DesignReviewActions({
  orderId,
  status,
  notes,
  reviewedByEmail,
}: {
  orderId: string;
  status: DesignStatus;
  notes: string | null;
  reviewedByEmail: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function approve() {
    setError(null);
    start(async () => {
      const res = await approveOrderDesign(orderId);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function reject() {
    setError(null);
    start(async () => {
      const res = await rejectOrderDesign(orderId, note);
      if (res.error) {
        setError(res.error);
        return;
      }
      setRejecting(false);
      setNote("");
      router.refresh();
    });
  }

  if (status === "PENDING_REVIEW") {
    return (
      <div className="space-y-2">
        {!rejecting ? (
          <div className="flex items-center gap-2">
            <button
              disabled={pending}
              onClick={approve}
              className="text-xs rounded-[var(--radius-xs)] bg-pine text-white px-2.5 py-1.5 hover:bg-pine-deep disabled:opacity-50"
            >
              Approve design
            </button>
            <button
              disabled={pending}
              onClick={() => setRejecting(true)}
              className="text-xs rounded-[var(--radius-xs)] border border-danger/40 text-danger px-2.5 py-1.5 hover:bg-danger-soft disabled:opacity-50"
            >
              Reject design
            </button>
          </div>
        ) : (
          <div className="space-y-1.5 max-w-sm">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why is this design being rejected? (shown to the venue)"
              rows={2}
              className="w-full rounded-[var(--radius-sm)] border border-line bg-surface px-2.5 py-1.5 text-xs focus:border-danger focus:outline-none resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                disabled={pending || !note.trim()}
                onClick={reject}
                className="text-xs rounded-[var(--radius-xs)] bg-danger text-white px-2.5 py-1.5 disabled:opacity-50"
              >
                Confirm reject
              </button>
              <button
                disabled={pending}
                onClick={() => {
                  setRejecting(false);
                  setNote("");
                  setError(null);
                }}
                className="text-xs rounded-[var(--radius-xs)] border border-line px-2.5 py-1.5 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="text-xs text-muted space-y-0.5">
      {reviewedByEmail && <p>Reviewed by {reviewedByEmail}</p>}
      {notes && <p className={status === "REJECTED" ? "text-danger" : undefined}>{notes}</p>}
      {status === "REJECTED" && (
        <button
          disabled={pending}
          onClick={approve}
          className="text-xs rounded-[var(--radius-xs)] border border-line px-2.5 py-1 hover:border-ink/30 disabled:opacity-50 mt-1"
        >
          Approve anyway
        </button>
      )}
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
