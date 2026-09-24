"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { motion, type HTMLMotionProps } from "motion/react";
import { SPRING_PRESS } from "./motion";
import { Spinner } from "./spinner";
import { buttonClasses, type ButtonVariant, type ButtonSize } from "./button-classes";

// The class strings live in ./button-classes (no "use client") so Server
// Components can style a <Link> identically; re-exported here so nothing
// that already imports them from this module has to change.
export { buttonClasses, type ButtonVariant, type ButtonSize };

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
