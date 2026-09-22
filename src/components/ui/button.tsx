"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { motion, type HTMLMotionProps } from "motion/react";
import { SPRING_PRESS } from "./motion";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft" | "ink";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  // The one loud action on a screen. Accent gradient + accent glow, so it
  // re-themes to the venue colour on customer pages.
  primary:
    "bg-accent-gradient text-on-accent shadow-accent hover:brightness-105 active:brightness-95",
  secondary:
    "bg-surface text-ink border border-line shadow-rest hover:border-line-strong hover:shadow-raised",
  ghost: "bg-transparent text-ink-soft hover:bg-surface-2 hover:text-ink",
  soft: "bg-pine-soft text-pine-deep hover:brightness-95",
  ink: "bg-ink text-surface hover:opacity-90",
  danger: "bg-danger text-white hover:brightness-95",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm rounded-[var(--radius-sm)]",
  md: "h-11 px-5 text-sm rounded-[var(--radius-md)]",
  lg: "h-13 min-h-[52px] px-6 text-base rounded-[var(--radius-lg)]",
};

const BASE =
  "inline-flex items-center justify-center gap-2 font-medium select-none transition-[filter,box-shadow,border-color,background-color] duration-[var(--dur-fast)]";

export function buttonClasses(variant: ButtonVariant, size: ButtonSize, full = false, extra = "") {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${full ? "w-full" : ""} ${extra}`;
}

type Props = Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  full?: boolean;
  children?: React.ReactNode;
};

// Press-animated button. whileTap scales down a hair with a stiff spring, so
// every tap has physical feedback; <MotionConfig reducedMotion="user"> at
// the root removes the scale for people who've asked for reduced motion.
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading = false, full = false, className = "", children, disabled, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={SPRING_PRESS}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${buttonClasses(variant, size, full, className)} disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none`}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </motion.button>
  );
});

const MotionLink = motion.create(Link);

// The same button, as a navigation link (marketing CTAs, "Get started",
// pricing cards). Same chrome and press feel as Button so a tap on a link
// and a tap on a button are indistinguishable.
export function LinkButton({
  variant = "primary",
  size = "md",
  full = false,
  className = "",
  href,
  children,
  prefetch,
  target,
  rel,
  "aria-label": ariaLabel,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
  href: string;
  children: React.ReactNode;
  prefetch?: boolean;
  target?: string;
  rel?: string;
  "aria-label"?: string;
}) {
  return (
    <MotionLink
      href={href}
      prefetch={prefetch}
      target={target}
      rel={rel}
      aria-label={ariaLabel}
      whileTap={{ scale: 0.97 }}
      transition={SPRING_PRESS}
      className={buttonClasses(variant, size, full, className)}
    >
      {children}
    </MotionLink>
  );
}
