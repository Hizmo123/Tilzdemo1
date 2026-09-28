"use client";

import { Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CardPreview, type CardPalette } from "../card-preview";

export type HeadlineMode = "TILLZ_DEFAULT" | "VENUE_NAME";

export function CardDesignStep({
  template,
  onTemplate,
  headlineMode,
  onHeadlineMode,
  headlineText,
  restaurantName,
  onPreview,
  onConfirm,
}: {
  template: CardPalette;
  onTemplate: (t: CardPalette) => void;
  headlineMode: HeadlineMode;
  onHeadlineMode: (m: HeadlineMode) => void;
  headlineText: string;
  restaurantName: string;
  onPreview: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Each stand ships with a printed card in this design — the real QR code is
        composited in after your stands are made.
      </p>

      <div className="grid sm:grid-cols-[1fr_auto] gap-6 items-start">
        <div className="space-y-4">
          <div>
            <Label>Template</Label>
            <div className="flex gap-2 mt-1.5">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={template === t}
                  onClick={() => onTemplate(t)}
                  className={`flex-1 h-11 rounded-[var(--radius-md)] border text-sm font-medium capitalize transition-colors duration-[var(--dur-fast)] ${
                    template === t ? "border-pine bg-pine-tint text-ink" : "border-line hover:border-line-strong text-ink-soft"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Headline</Label>
            <div className="space-y-1.5 mt-1.5">
              <HeadlineOption
                checked={headlineMode === "TILLZ_DEFAULT"}
                onSelect={() => onHeadlineMode("TILLZ_DEFAULT")}
                label="Keep Tillz branding"
              />
              <HeadlineOption
                checked={headlineMode === "VENUE_NAME"}
                onSelect={() => onHeadlineMode("VENUE_NAME")}
                label={`Use “${restaurantName}”`}
              />
            </div>
          </div>
        </div>

        <div className="w-40 mx-auto sm:mx-0">
          <CardPreview palette={template} headlineText={headlineText} />
          <button
            type="button"
            onClick={onPreview}
            className="mt-2 w-full h-9 text-xs rounded-[var(--radius-sm)] border border-line hover:border-line-strong transition-colors duration-[var(--dur-fast)]"
          >
            Preview card
          </button>
        </div>
      </div>

      <div className="max-w-xs">
        <Button type="button" variant="secondary" full onClick={onConfirm}>
          Looks good
        </Button>
      </div>
    </div>
  );
}

function HeadlineOption({ checked, onSelect, label }: { checked: boolean; onSelect: () => void; label: string }) {
  return (
    <label
      className={`flex items-center gap-2.5 rounded-[var(--radius-sm)] border px-3 h-11 text-sm cursor-pointer transition-colors duration-[var(--dur-fast)] ${
        checked ? "border-pine bg-pine-tint" : "border-line hover:border-line-strong"
      }`}
    >
      <input type="radio" checked={checked} onChange={onSelect} className="accent-pine" />
      <span className="truncate">{label}</span>
    </label>
  );
}
