"use client";

import { useState } from "react";

// Web NFC (writing tags from the browser) is Android-Chrome only — feature-
// detected via NDEFReader. Everywhere else (iPhone, desktop) we show the manual
// path: copy the table's URL and write it with a free NFC app. Either way the
// data on the tag is identical to the table's QR — same URL, same destination.
interface NDEFReaderLike {
  write(message: unknown): Promise<void>;
}
declare global {
  interface Window {
    NDEFReader?: { new (): NDEFReaderLike };
  }
}

export function NfcSection({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [writing, setWriting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const supportsWrite =
    typeof window !== "undefined" && !!window.NDEFReader;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatus("Couldn't copy — select the address and copy it manually.");
    }
  }

  async function writeTag() {
    setStatus(null);
    setWriting(true);
    try {
      const ndef = new window.NDEFReader!();
      await ndef.write({ records: [{ recordType: "url", data: url }] });
      setStatus("✓ Written! Tap the tag with a phone to test it.");
    } catch {
      setStatus("Couldn't write the tag. Hold it steady against the phone and try again.");
    } finally {
      setWriting(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
        NFC tag
      </h2>
      <p className="text-sm text-muted mb-4">
        Put this table&apos;s address on an NFC tag so customers can tap instead of
        scan. It&apos;s the same link as the QR code.
      </p>

      <div className="flex items-center gap-2 mb-4">
        <code className="flex-1 text-xs break-all bg-paper rounded-[var(--radius-xs)] px-2 py-1.5">
          {url}
        </code>
        <button
          onClick={copy}
          className="text-xs rounded-[var(--radius-xs)] border border-line px-2.5 py-1.5 hover:border-ink/30 shrink-0"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {supportsWrite ? (
        <button
          onClick={writeTag}
          disabled={writing}
          className="rounded-[var(--radius-sm)] bg-pine text-white px-4 py-2.5 text-sm font-medium hover:bg-pine-deep disabled:opacity-60"
        >
          {writing ? "Hold tag to phone…" : "Write to tag"}
        </button>
      ) : (
        <div className="rounded-[var(--radius-sm)] bg-paper p-3 text-sm text-muted">
          <p className="font-medium text-ink mb-1">To write a tag:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Install the free “NFC Tools” app on your phone.</li>
            <li>Open it → Write → Add a record → URL.</li>
            <li>Paste the address above, then tap a blank tag to write it.</li>
          </ol>
          <p className="text-xs mt-2">
            (iPhones can&apos;t write tags from a website — that&apos;s an Apple
            limit — so the app is the way. On Android Chrome a “Write to tag”
            button appears here instead.)
          </p>
        </div>
      )}

      {status && <p className="text-sm mt-3 text-muted">{status}</p>}
    </div>
  );
}
