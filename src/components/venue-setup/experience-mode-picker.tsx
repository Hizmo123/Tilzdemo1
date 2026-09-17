"use client";

import {
  EXPERIENCE_MODES,
  summarizeExperience,
  type ExperienceModeKey,
  type ExperienceSettings,
} from "@/lib/onboarding-options";
import { Icon } from "./icons";

const PRESET_KEYS = Object.keys(EXPERIENCE_MODES) as (keyof typeof EXPERIENCE_MODES)[];

// The four real presets plus Custom. Picking a preset writes its whole
// settings combination; Custom reveals the same toggles Settings uses so it's
// never a dead end.
export function ExperienceModePicker({
  mode,
  settings,
  onChange,
}: {
  mode: ExperienceModeKey;
  settings: ExperienceSettings;
  onChange: (mode: ExperienceModeKey, settings: ExperienceSettings) => void;
}) {
  return (
    <div className="space-y-2">
      {PRESET_KEYS.map((key) => {
        const preset = EXPERIENCE_MODES[key];
        const active = mode === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key, preset.settings)}
            className={`w-full text-left rounded-[var(--radius-card)] border-2 p-3.5 transition-colors ${
              active ? "border-pine bg-pine-soft" : "border-line hover:border-ink/20"
            }`}
          >
            <span className="flex items-center gap-3">
              <span
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                  active
                    ? "bg-pine text-[color:var(--on-accent,#fff)]"
                    : "bg-paper text-muted"
                }`}
              >
                <Icon name={preset.icon} className="w-4.5 h-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{preset.label}</span>
                <span className="block text-xs text-muted mt-0.5">{preset.blurb}</span>
              </span>
            </span>
            <span className="block text-[11px] text-muted mt-2 pl-12">
              {summarizeExperience(preset.settings)}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => onChange("custom", settings)}
        className={`w-full text-left rounded-[var(--radius-card)] border-2 p-3.5 transition-colors ${
          mode === "custom" ? "border-pine bg-pine-soft" : "border-line hover:border-ink/20"
        }`}
      >
        <span className="flex items-center gap-3">
          <span
            className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
              mode === "custom"
                ? "bg-pine text-[color:var(--on-accent,#fff)]"
                : "bg-paper text-muted"
            }`}
          >
            <Icon name="sliders" className="w-4.5 h-4.5" />
          </span>
          <span>
            <span className="block text-sm font-medium">Custom</span>
            <span className="block text-xs text-muted mt-0.5">
              Choose each setting yourself.
            </span>
          </span>
        </span>
      </button>

      {mode === "custom" && (
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-3.5 space-y-4 mt-1">
          <ToggleRow
            label="How do guests order?"
            a={{ label: "They order from their phone", value: true }}
            b={{ label: "Staff take the orders", value: false }}
            current={settings.customerOrdering}
            onPick={(v) => onChange("custom", { ...settings, customerOrdering: v })}
          />
          <ToggleRow
            label="How do guests pay?"
            a={{ label: "From their phone", value: true }}
            b={{ label: "At the counter / with staff", value: false }}
            current={settings.customerPayment}
            onPick={(v) => onChange("custom", { ...settings, customerPayment: v })}
          />
          {settings.customerPayment && (
            <ToggleRow
              label="When do they pay?"
              a={{ label: "After — running tab", value: "after" as const }}
              b={{ label: "Before — prepay", value: "before" as const }}
              current={settings.paymentTiming}
              onPick={(v) => onChange("custom", { ...settings, paymentTiming: v })}
            />
          )}
          <ToggleRow
            label="Approve orders before the kitchen?"
            a={{ label: "No — straight to the kitchen", value: false }}
            b={{ label: "Yes — staff accept first", value: true }}
            current={settings.staffApproval}
            onPick={(v) => onChange("custom", { ...settings, staffApproval: v })}
          />
        </div>
      )}
    </div>
  );
}

function ToggleRow<T extends string | boolean>({
  label,
  a,
  b,
  current,
  onPick,
}: {
  label: string;
  a: { label: string; value: T };
  b: { label: string; value: T };
  current: T;
  onPick: (value: T) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted mb-1.5">{label}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {[a, b].map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onPick(opt.value)}
            className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
              current === opt.value
                ? "border-pine bg-pine-soft text-pine-deep"
                : "border-line hover:border-ink/20"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
