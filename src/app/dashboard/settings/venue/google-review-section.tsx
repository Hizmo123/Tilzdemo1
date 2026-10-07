"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { setGoogleReviewUrl, removeGoogleReviewUrl } from "./google-review-actions";

// Available on every plan, including Lite — never gated behind
// entitlements (see google-review-actions.ts). Validation happens
// server-side (normalizeGoogleReviewUrl) so this component never has to
// duplicate the hostname allowlist; it just shows back whatever error the
// server returns.
export function GoogleReviewSection({ savedUrl }: { savedUrl: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const res = await setGoogleReviewUrl(value);
      if (res.error) setError(res.error);
      else {
        setValue("");
        router.refresh();
      }
    });
  }

  function remove() {
    setError(null);
    start(async () => {
      const res = await removeGoogleReviewUrl();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
          Google reviews
        </h2>
        <p className="text-sm text-muted">
          Guests see a prompt to leave a Google review right after they pay.
        </p>
      </div>

      {savedUrl ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs break-all bg-paper rounded-[var(--radius-xs)] px-2 py-1.5">
              {savedUrl}
            </code>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={savedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[var(--radius-sm)] border border-line px-3.5 py-2 text-sm font-medium hover:border-ink/30 transition-colors"
            >
              Test link
            </a>
            <Button variant="ghost" size="sm" onClick={remove} disabled={pending}>
              {pending ? "Removing…" : "Remove"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label htmlFor="google-review-input">Review link or Place ID</Label>
            <Input
              id="google-review-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://g.page/r/... or ChIJ..."
              invalid={!!error}
            />
          </div>
          <FormMessage>{error}</FormMessage>
          <p className="text-xs text-muted">
            Find your link in Google Business Profile → Get more reviews → Share review
            form. Or paste just the Place ID — use Google&apos;s{" "}
            <a
              href="https://developers.google.com/maps/documentation/places/web-service/place-id"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pine hover:underline"
            >
              Place ID Finder
            </a>{" "}
            to look it up.
          </p>
          <Button onClick={save} disabled={pending || !value.trim()} size="sm">
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
