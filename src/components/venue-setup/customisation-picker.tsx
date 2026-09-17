"use client";

import { BG_PATTERNS, type CardStyle } from "@/lib/menu-style";

const SEGMENT = "px-3 py-1.5 text-sm rounded-md transition-colors";
const SEGMENT_ACTIVE = "bg-pine text-[color:var(--on-accent,#fff)]";
const SEGMENT_INACTIVE = "text-muted hover:text-ink";

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-line p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`${SEGMENT} ${value === o.value ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Card style + typography + section headers + button style + background —
// the A5 deep-customisation controls, all in one picker since they're only
// ever edited together on the branding page. Every change here shows up
// live in the customer-preview rendered alongside this component.
export function CustomisationPicker({
  cardStyle,
  onCardStyleChange,
  typeScale,
  onTypeScaleChange,
  sectionHeaderStyle,
  onSectionHeaderStyleChange,
  buttonShape,
  onButtonShapeChange,
  buttonFill,
  onButtonFillChange,
  bgTreatment,
  onBgTreatmentChange,
  bgPatternKey,
  onBgPatternKeyChange,
  bgOverlayStrength,
  onBgOverlayStrengthChange,
  hasBgImage,
}: {
  cardStyle: CardStyle;
  onCardStyleChange: (cs: CardStyle) => void;
  typeScale: string;
  onTypeScaleChange: (v: string) => void;
  sectionHeaderStyle: string;
  onSectionHeaderStyleChange: (v: string) => void;
  buttonShape: string;
  onButtonShapeChange: (v: string) => void;
  buttonFill: string;
  onButtonFillChange: (v: string) => void;
  bgTreatment: string;
  onBgTreatmentChange: (v: string) => void;
  bgPatternKey: string;
  onBgPatternKeyChange: (v: string) => void;
  bgOverlayStrength: number;
  onBgOverlayStrengthChange: (v: number) => void;
  hasBgImage: boolean;
}) {
  const setCard = (patch: Partial<CardStyle>) => onCardStyleChange({ ...cardStyle, ...patch });

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm text-muted block mb-2">Item photo</label>
        <div className="flex flex-wrap gap-3">
          <Segmented
            value={cardStyle.imagePosition}
            onChange={(v) => setCard({ imagePosition: v })}
            options={[
              { value: "left", label: "Left" },
              { value: "top", label: "Top" },
              { value: "none", label: "Hidden" },
            ]}
          />
          {cardStyle.imagePosition !== "none" && (
            <Segmented
              value={cardStyle.imageAspect}
              onChange={(v) => setCard({ imageAspect: v })}
              options={[
                { value: "square", label: "Square" },
                { value: "4:3", label: "4:3" },
                { value: "16:9", label: "Wide" },
              ]}
            />
          )}
        </div>
      </div>

      <div>
        <label className="text-sm text-muted block mb-2">Card border & shadow</label>
        <div className="flex flex-wrap gap-3">
          <Segmented
            value={cardStyle.border}
            onChange={(v) => setCard({ border: v })}
            options={[
              { value: "none", label: "No border" },
              { value: "thin", label: "Thin" },
              { value: "bold", label: "Bold" },
            ]}
          />
          <Segmented
            value={cardStyle.shadow}
            onChange={(v) => setCard({ shadow: v })}
            options={[
              { value: "none", label: "Flat" },
              { value: "soft", label: "Soft shadow" },
              { value: "lifted", label: "Lifted" },
            ]}
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-muted block mb-2">Spacing between items</label>
        <Segmented
          value={cardStyle.divider}
          onChange={(v) => setCard({ divider: v })}
          options={[
            { value: "none", label: "Tight" },
            { value: "line", label: "Divider line" },
            { value: "space", label: "Extra space" },
          ]}
        />
      </div>

      <div>
        <label className="text-sm text-muted block mb-2">Text size</label>
        <Segmented
          value={typeScale}
          onChange={onTypeScaleChange}
          options={[
            { value: "compact", label: "Compact" },
            { value: "comfortable", label: "Comfortable" },
            { value: "large", label: "Large" },
          ]}
        />
      </div>

      <div>
        <label className="text-sm text-muted block mb-2">Section headers</label>
        <Segmented
          value={sectionHeaderStyle}
          onChange={onSectionHeaderStyleChange}
          options={[
            { value: "plain", label: "Plain" },
            { value: "underline", label: "Underline" },
            { value: "pill", label: "Pill" },
            { value: "bold-caps", label: "Bold caps" },
          ]}
        />
      </div>

      <div>
        <label className="text-sm text-muted block mb-2">Buttons</label>
        <div className="flex flex-wrap gap-3">
          <Segmented
            value={buttonShape}
            onChange={onButtonShapeChange}
            options={[
              { value: "pill", label: "Pill" },
              { value: "rounded", label: "Rounded" },
              { value: "square", label: "Square" },
            ]}
          />
          <Segmented
            value={buttonFill}
            onChange={onButtonFillChange}
            options={[
              { value: "solid", label: "Solid" },
              { value: "outline", label: "Outline" },
              { value: "soft", label: "Soft" },
            ]}
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-muted block mb-2">Page background</label>
        <Segmented
          value={bgTreatment}
          onChange={onBgTreatmentChange}
          options={[
            { value: "solid", label: "Solid" },
            { value: "pattern", label: "Pattern" },
            { value: "photo", label: "Photo" },
          ]}
        />
        {bgTreatment === "pattern" && (
          <div className="mt-2">
            <Segmented
              value={bgPatternKey}
              onChange={onBgPatternKeyChange}
              options={BG_PATTERNS.map((p) => ({ value: p.key, label: p.label }))}
            />
          </div>
        )}
        {bgTreatment === "photo" && !hasBgImage && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-2.5 py-1.5 mt-2">
            Upload a background photo below to use this — until then the page
            shows the solid background instead.
          </p>
        )}
        {bgTreatment === "photo" && hasBgImage && (
          <div className="mt-2">
            <label className="text-xs text-muted block mb-1">
              Overlay strength — how much the photo is dimmed so text stays readable
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={bgOverlayStrength}
              onChange={(e) => onBgOverlayStrengthChange(Number(e.target.value))}
              className="w-full max-w-xs accent-pine"
            />
          </div>
        )}
      </div>
    </div>
  );
}
