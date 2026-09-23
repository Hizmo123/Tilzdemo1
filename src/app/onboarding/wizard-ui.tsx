"use client";

import { useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { buttonClasses } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EASE_OUT, SPRING_PRESS } from "@/components/ui/motion";

// The wizard's own chrome — stepper, step transitions, form fields, the
// number stepper, image upload tiles — on the Phase 0 tokens. Step CONTENT
// (the pickers) lives in components/venue-setup so Settings shares it.

// ---- Stepper ----------------------------------------------------------------
// One segment per step. Completed segments are filled; the current one
// fills in from the left as you arrive on it, so advancing reads as
// progress being made rather than a bar that just got longer.
export function Stepper({
  steps,
  current,
}: {
  steps: { id: string; label: string }[];
  current: number;
}) {
  const reduced = useReducedMotion();
  const label = steps[current]?.label ?? "";
  return (
    <div className="mb-8" aria-label={`Step ${current + 1} of ${steps.length}: ${label}`}>
      <div className="mb-2 flex items-center justify-between text-xs text-muted h-4">
        <span className="tabular">
          Step {current + 1} of {steps.length}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={label}
            initial={reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="font-medium text-ink-soft"
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={current + 1}>
        {steps.map((s, i) => (
          <div key={s.id} className="h-1.5 flex-1 rounded-pill bg-line overflow-hidden">
            <motion.div
              className="h-full rounded-pill bg-pine origin-left"
              initial={false}
              animate={{ scaleX: i <= current ? 1 : 0 }}
              transition={reduced ? { duration: 0 } : { duration: i === current ? 0.35 : 0.2, ease: EASE_OUT }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Step transition -------------------------------------------------------
// Outgoing step slides out the way you're travelling, incoming slides in
// behind it. Short (200ms) so someone blasting through setup never waits on
// it; reduced motion collapses to an instant swap.
export function StepPanel({
  stepKey,
  direction,
  children,
}: {
  stepKey: string;
  direction: 1 | -1;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const dist = reduced ? 0 : 28 * direction;
  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, x: dist }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -dist }}
        transition={reduced ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function StepFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="font-display text-display-sm font-semibold">{title}</h1>
      <p className="text-muted text-sm mt-1.5 mb-6 leading-relaxed">{subtitle}</p>
      {children}
    </div>
  );
}

// ---- Fields -----------------------------------------------------------------
export function FieldLabel({ children, hint, htmlFor }: { children: React.ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-soft mb-1.5">
      {children}
      {hint && <span className="font-normal text-muted text-xs"> {hint}</span>}
    </label>
  );
}

export const SELECT_CLASS =
  "w-full h-11 appearance-none rounded-[var(--radius-md)] bg-surface border border-line shadow-rest px-3.5 pr-10 text-sm text-ink transition-[border-color,box-shadow] duration-[var(--dur-fast)] hover:border-line-strong focus:outline-none focus:border-pine focus:ring-[3px] focus:ring-pine/20 disabled:opacity-60";

export function SelectField({
  label,
  hint,
  value,
  onChange,
  children,
  helper,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  helper?: string;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel htmlFor={id} hint={hint}>
        {label}
      </FieldLabel>
      <div className="relative">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_CLASS}>
          {children}
        </select>
        <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 8l5 5 5-5" />
        </svg>
      </div>
      {helper && <p className="text-xs text-muted mt-1.5">{helper}</p>}
    </div>
  );
}

// ---- Number stepper --------------------------------------------------------
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 200,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const btn =
    "w-11 h-11 rounded-[var(--radius-md)] bg-surface border border-line shadow-rest text-xl leading-none text-ink-soft hover:border-line-strong hover:shadow-raised disabled:opacity-40 disabled:shadow-none transition-[box-shadow,border-color] duration-[var(--dur-fast)]";
  return (
    <div className="flex items-center gap-3">
      <motion.button type="button" aria-label={`Fewer ${label}`} whileTap={{ scale: 0.94 }} transition={SPRING_PRESS} disabled={value <= min} onClick={() => onChange(clamp(value - 1))} className={btn}>
        −
      </motion.button>
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
        className="w-20 h-11 text-center font-display text-display-sm font-semibold tabular rounded-[var(--radius-md)] border border-line bg-surface shadow-rest focus:outline-none focus:border-pine focus:ring-[3px] focus:ring-pine/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <motion.button type="button" aria-label={`More ${label}`} whileTap={{ scale: 0.94 }} transition={SPRING_PRESS} disabled={value >= max} onClick={() => onChange(clamp(value + 1))} className={btn}>
        +
      </motion.button>
    </div>
  );
}

// ---- Image upload tile -----------------------------------------------------
// The preview IS the loading state: while compressing + uploading, the
// picked image shows dimmed under a shimmer with an indeterminate bar along
// the bottom, so the tile looks like the thing that's arriving.
export function ImageUploadTile({
  preview,
  uploading,
  error,
  onPick,
  onRemove,
  shape,
  label,
  hint,
  emptyText,
  hasStored,
}: {
  preview: string | null;
  uploading: boolean;
  error: string | null;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove?: () => void;
  shape: "square" | "wide";
  label: string;
  hint?: string;
  emptyText: string;
  hasStored: boolean;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  const box =
    shape === "square"
      ? "w-16 h-16 rounded-[var(--radius-md)]"
      : "w-full h-28 rounded-[var(--radius-md)]";
  const fit = shape === "square" ? "object-contain" : "object-cover";

  const tile = (
    <div className={`relative overflow-hidden border border-line bg-surface-2/60 flex items-center justify-center shrink-0 ${box}`}>
      {preview ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={preview} alt="" className={`w-full h-full ${fit} transition-opacity duration-[var(--dur-base)] ${uploading ? "opacity-50" : ""}`} />
      ) : (
        <span className="text-[11px] text-muted px-2 text-center leading-snug">{emptyText}</span>
      )}
      <AnimatePresence>
        {uploading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0"
            aria-live="polite"
            aria-label="Uploading"
          >
            <div className="absolute inset-0 skeleton opacity-60" />
            <div className="absolute inset-0 flex items-center justify-center text-ink-soft">
              <Spinner className="h-5 w-5" />
            </div>
            <div className="absolute left-0 right-0 bottom-0 h-1 bg-line overflow-hidden">
              <motion.div
                className="h-full w-1/3 bg-pine rounded-pill"
                animate={reduced ? undefined : { x: ["-100%", "300%"] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div>
      <FieldLabel htmlFor={id} hint={hint}>
        {label}
      </FieldLabel>
      <div className={shape === "square" ? "flex items-center gap-3" : "space-y-2"}>
        {tile}
        <div className="flex items-center gap-2">
          <input id={id} type="file" accept="image/*" onChange={onPick} className="sr-only" disabled={uploading} />
          {/* A <label> wearing the secondary Button's chrome: clicking it
              opens the (visually hidden) file input. */}
          <label
            htmlFor={id}
            aria-disabled={uploading || undefined}
            className={`${buttonClasses("secondary", "sm")} cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : ""}`}
          >
            {uploading ? "Uploading…" : hasStored ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          </label>
          {hasStored && !uploading && onRemove && (
            <button type="button" onClick={onRemove} className="text-sm text-muted hover:text-danger px-1">
              Remove
            </button>
          )}
        </div>
      </div>
      <AnimatePresence>
        {error && (
          <motion.p key={error} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0, x: [0, -5, 5, -3, 3, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="text-xs text-danger mt-1.5" role="alert">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- Inline error -----------------------------------------------------------
// Same rise-in + one shake as the auth forms and the customer pay sheet.
export function WizardError({ children }: { children?: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {children && (
        <motion.p
          key={children}
          role="alert"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-4 rounded-[var(--radius-sm)] bg-danger-soft text-danger px-3.5 py-2.5 text-sm"
        >
          {children}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
