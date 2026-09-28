"use client";

import { Button } from "@/components/ui/button";
import type { ProductRow, StagedDesign } from "./types";

const MIME_LABELS: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "application/pdf": "PDF",
  "image/svg+xml": "SVG",
};

export function ArtworkStep({
  product,
  design,
  uploading,
  error,
  onPickFile,
  onRemove,
  onSkip,
  onContinue,
}: {
  product: ProductRow;
  design: StagedDesign | null;
  uploading: boolean;
  error: string | null;
  onPickFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  // Only offered when the product doesn't require artwork — never silent.
  onSkip: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted space-y-2">
        <p>
          {product.requiresCustomDesign
            ? "This product is printed with your own artwork — upload it to continue."
            : "Optional — replace the Tillz card design with your own artwork."}
        </p>
        {product.designGuidelines && <p className="whitespace-pre-line">{product.designGuidelines}</p>}
        <p className="text-xs">
          Accepted: {product.acceptedDesignMimeTypes.map((m) => MIME_LABELS[m] ?? m).join(", ")} · up to{" "}
          {product.maxDesignSizeMb} MB.
        </p>
      </div>

      {design ? (
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line bg-paper px-3.5 py-2.5">
          {design.url.match(/\.(png|jpe?g)$/i) ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={design.url} alt="" className="w-12 h-12 rounded-[var(--radius-sm)] object-cover border border-line shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-[var(--radius-sm)] bg-surface border border-line shrink-0 flex items-center justify-center text-[10px] text-muted">
              FILE
            </div>
          )}
          <span className="text-sm truncate flex-1 min-w-0">{design.fileName}</span>
          <button type="button" onClick={onRemove} className="text-xs text-muted hover:text-danger shrink-0">
            Remove
          </button>
        </div>
      ) : (
        <div>
          <label
            className={`inline-flex items-center justify-center h-11 rounded-[var(--radius-md)] border border-line px-4 text-sm font-medium cursor-pointer hover:border-line-strong transition-colors duration-[var(--dur-fast)] ${
              uploading ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            {uploading ? "Uploading…" : "Choose file"}
            <input
              type="file"
              accept={product.acceptedDesignMimeTypes.join(",")}
              onChange={onPickFile}
              disabled={uploading}
              className="sr-only"
            />
          </label>
          {error && <p className="text-xs text-danger mt-2">{error}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {design ? (
          <Button type="button" variant="secondary" onClick={onContinue}>
            Continue
          </Button>
        ) : (
          !product.requiresCustomDesign && (
            <Button type="button" variant="secondary" onClick={onSkip}>
              Skip — use the Tillz design
            </Button>
          )
        )}
      </div>
    </div>
  );
}
