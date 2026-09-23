"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  EXPERIENCE_MODES,
  summarizeExperience,
  type ExperienceModeKey,
  type ExperienceSettings,
} from "@/lib/onboarding-options";
import { Icon } from "./icons";
import { ChoiceCard, PillOption } from "./choice";

const PRESET_KEYS = Object.keys(EXPERIENCE_MODES) as (keyof typeof EXPERIENCE_MODES)[];

// The real presets plus Custom. Picking a preset writes its whole settings
// combination; Custom reveals the same toggles Settings uses so it's never
// a dead end.
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
    <div role="radiogroup" className="space-y-2">
      {PRESET_KEYS.map((key) => {
        const preset = EXPERIENCE_MODES[key];
        return (
          <ChoiceCard
            key={key}
            selected={mode === key}
            onClick={() => onChange(key, preset.settings)}
            title={preset.label}
            desc={preset.blurb}
            footnote={summarizeExperience(preset.settings)}
            icon={<Icon name={preset.icon} className="w-4.5 h-4.5" />}
          />
        );
      })}

      <ChoiceCard
        selected={mode === "custom"}
        onClick={() => onChange("custom", settings)}
        title="Custom"
        desc="Choose each setting yourself."
        icon={<Icon name="sliders" className="w-4.5 h-4.5" />}
      />

      <AnimatePresence initial={false}>
        {mode === "custom" && (
          <motion.div
            key="custom"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-[var(--radius-card)] border border-line bg-surface shadow-rest p-3.5 space-y-4 mt-1">
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
          </motion.div>
        )}
      </AnimatePresence>
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
      <div role="radiogroup" className="grid grid-cols-2 gap-1.5">
        {[a, b].map((opt) => (
          <PillOption key={String(opt.value)} selected={current === opt.value} onClick={() => onPick(opt.value)} className="text-xs px-2.5">
            {opt.label}
          </PillOption>
        ))}
      </div>
    </div>
  );
}
