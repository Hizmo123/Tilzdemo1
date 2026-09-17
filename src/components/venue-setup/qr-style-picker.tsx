"use client";

// QR colour/corner/logo + printable table-card template — separate from
// CustomisationPicker since this styles a physically-printed artifact, not
// the on-screen menu, and lives in its own card on the branding page.
export function QrStylePicker({
  foregroundColor,
  onForegroundColorChange,
  backgroundColor,
  onBackgroundColorChange,
  cornerStyle,
  onCornerStyleChange,
  embedLogo,
  onEmbedLogoChange,
  hasLogo,
  cardTemplate,
  onCardTemplateChange,
}: {
  foregroundColor: string;
  onForegroundColorChange: (v: string) => void;
  backgroundColor: string;
  onBackgroundColorChange: (v: string) => void;
  cornerStyle: string;
  onCornerStyleChange: (v: string) => void;
  embedLogo: boolean;
  onEmbedLogoChange: (v: boolean) => void;
  hasLogo: boolean;
  cardTemplate: string;
  onCardTemplateChange: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <div>
          <label className="text-sm text-muted block mb-1.5">QR colour</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(foregroundColor) ? foregroundColor : "#15181b"}
              onChange={(e) => onForegroundColorChange(e.target.value)}
              className="w-9 h-9 rounded-lg border border-line bg-transparent cursor-pointer p-0"
            />
            <button
              type="button"
              onClick={() => onForegroundColorChange("")}
              className="text-xs text-muted hover:text-ink"
            >
              Reset
            </button>
          </div>
        </div>
        <div>
          <label className="text-sm text-muted block mb-1.5">Background</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(backgroundColor) ? backgroundColor : "#ffffff"}
              onChange={(e) => onBackgroundColorChange(e.target.value)}
              className="w-9 h-9 rounded-lg border border-line bg-transparent cursor-pointer p-0"
            />
            <button
              type="button"
              onClick={() => onBackgroundColorChange("")}
              className="text-xs text-muted hover:text-ink"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm text-muted block mb-2">Corner style</label>
        <div className="inline-flex rounded-lg border border-line p-0.5 gap-0.5">
          {(
            [
              ["square", "Square"],
              ["rounded", "Rounded"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => onCornerStyleChange(v)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                cornerStyle === v
                  ? "bg-pine text-[color:var(--on-accent,#fff)]"
                  : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={embedLogo}
          onChange={(e) => onEmbedLogoChange(e.target.checked)}
          disabled={!hasLogo}
          className="accent-pine w-4 h-4 mt-0.5"
        />
        <span>
          <span className="font-medium">Embed your logo in the QR code</span>
          <span className="block text-muted text-xs">
            {hasLogo
              ? "Uses higher error correction so it still scans reliably."
              : "Upload a logo below first."}
          </span>
        </span>
      </label>

      <div>
        <label className="text-sm text-muted block mb-2">Printable table-card template</label>
        <div className="grid grid-cols-3 gap-2 max-w-sm">
          {(
            [
              ["minimal", "Minimal"],
              ["branded", "Branded"],
              ["bold", "Bold"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => onCardTemplateChange(v)}
              className={`rounded-lg border-2 py-2 text-sm font-medium transition-colors ${
                cardTemplate === v
                  ? "border-pine bg-pine-soft text-pine-deep"
                  : "border-line hover:border-ink/20"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
