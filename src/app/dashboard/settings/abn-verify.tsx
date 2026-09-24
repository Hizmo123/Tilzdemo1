"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lookupAbnAction, confirmAbnVerification, type AbnLookupState } from "./abn-actions";

// Replaces phone verification as the "is this a real business" check: looks
// the ABN up against the Australian Business Register, shows the registered
// entity name back, and only stores it once the owner confirms that's them.
// Operates on the ABN already typed into the Venue section's own field
// (passed in as `abn`) rather than a second duplicate input — if that field
// changes, the verified badge below stops matching and disappears on its
// own, correctly prompting re-verification.
export function AbnVerify({
  abn,
  verifiedAt,
  verifiedName,
  verifiedAbn,
}: {
  abn: string;
  verifiedAt: string | null;
  verifiedName: string | null;
  verifiedAbn: string | null;
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<AbnLookupState | null>(null);
  const [pending, start] = useTransition();

  const digits = abn.replace(/\s+/g, "");
  const matchesVerified =
    verifiedAt && verifiedName && verifiedAbn && digits === verifiedAbn.replace(/\s+/g, "");

  if (matchesVerified) {
    return (
      <p className="text-sm">
        <span className="text-pine-deep font-medium">✓ Verified business</span>{" "}
        <span className="text-muted">
          — {verifiedName} · verified {new Date(verifiedAt).toLocaleDateString("en-AU")}
        </span>
      </p>
    );
  }

  function doLookup() {
    setPreview(null);
    start(async () => {
      const res = await lookupAbnAction(abn);
      setPreview(res);
    });
  }

  function confirm() {
    start(async () => {
      const res = await confirmAbnVerification(abn);
      if (res.error) setPreview({ error: res.error });
      else router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending || digits.length < 11}
        onClick={doLookup}
        className="rounded-[var(--radius-sm)] border border-line px-4 py-2.5 text-sm font-medium hover:border-ink/30 disabled:opacity-50"
      >
        {pending && !preview ? "Looking up…" : "Look up & verify this ABN"}
      </button>

      {preview && "error" in preview && (
        <p className="text-xs text-danger">{preview.error}</p>
      )}

      {preview && "ok" in preview && (
        <div className="rounded-[var(--radius-sm)] border border-line bg-paper p-3.5 space-y-2">
          <p className="text-sm">
            <span className="font-medium">{preview.entityName}</span>
            <span className="text-muted">
              {" "}
              · {preview.abnStatus}
              {preview.gstRegistered ? " · GST registered" : ""}
            </span>
          </p>
          {preview.test && (
            <p className="text-xs text-warn bg-warn-soft rounded-[var(--radius-xs)] px-2 py-1.5">
              Dev mode (no ABR_GUID configured) — this is a placeholder
              result, not a real lookup. Add an Australian Business Register
              GUID to verify real ABNs.
            </p>
          )}
          <p className="text-sm text-ink-soft">Is this your business?</p>
          <button
            disabled={pending}
            onClick={confirm}
            className="rounded-[var(--radius-sm)] bg-pine text-white px-4 py-2 text-sm font-medium hover:bg-pine-deep disabled:opacity-50"
          >
            {pending ? "Confirming…" : "Yes, this is us"}
          </button>
        </div>
      )}
    </div>
  );
}
