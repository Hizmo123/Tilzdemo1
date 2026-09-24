"use client";

import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";

type ScannerStatus = "starting" | "scanning" | "no-camera" | "denied" | "error";

// Camera view for scan-to-activate (see activate-stand-form.tsx). Decodes
// whatever QR/barcode the device camera sees and hands the raw text up —
// this component knows nothing about stands/serials, that resolution
// happens server-side (resolveScannedStandCode in ../actions.ts) so a
// future print-spec change (see this task's report) needs no client change.
//
// qr-scanner (not html5-qrcode): actively maintained, a single (types-only)
// dependency, and uses the browser's native BarcodeDetector where available
// with a small WASM fallback — Next.js's bundler resolves its worker via a
// standard dynamic import, no extra webpack config needed.
export function StandScanner({
  onDecoded,
  onCancel,
}: {
  onDecoded: (raw: string) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  // Always current inside the mount-once effect below, without making the
  // effect re-run (and the camera restart) every time the parent re-renders
  // with a fresh onDecoded closure.
  const onDecodedRef = useRef(onDecoded);
  useEffect(() => {
    onDecodedRef.current = onDecoded;
  }, [onDecoded]);

  const [status, setStatus] = useState<ScannerStatus>("starting");

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!videoRef.current) return;
      let hasCamera: boolean;
      try {
        hasCamera = await QrScanner.hasCamera();
      } catch {
        hasCamera = false;
      }
      if (!hasCamera) {
        if (!cancelled) setStatus("no-camera");
        return;
      }

      const scanner = new QrScanner(
        videoRef.current,
        (result) => onDecodedRef.current(result.data),
        {
          preferredCamera: "environment",
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 5,
        },
      );
      scannerRef.current = scanner;
      try {
        await scanner.start();
        if (!cancelled) setStatus("scanning");
      } catch {
        // Permission denied, camera in use elsewhere, or an insecure
        // (non-HTTPS) context — any of these throw the same way here.
        if (!cancelled) setStatus("denied");
      }
    }

    start();
    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, []);

  const STATUS_COPY: Record<Exclude<ScannerStatus, "scanning">, string> = {
    starting: "Starting camera…",
    "no-camera": "No camera found on this device.",
    denied: "Camera access was denied — check your browser's permission for this site.",
    error: "Couldn't start the camera.",
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-[var(--radius-card)] overflow-hidden bg-ink aspect-square max-w-xs mx-auto">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        {status !== "scanning" && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/85 text-white text-sm text-center px-5">
            {STATUS_COPY[status]}
          </div>
        )}
      </div>
      <p className="text-xs text-muted text-center">
        {status === "scanning" ? "Point the camera at the code on the stand." : " "}
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="block w-full text-center text-sm text-pine hover:underline"
      >
        Type the serial instead
      </button>
    </div>
  );
}
