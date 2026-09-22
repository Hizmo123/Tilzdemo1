"use client";

import { AnimatePresence, motion } from "motion/react";
import { FormMessage } from "@/components/ui/field";

// Auth-form error: the inline message rises in and shakes once, the same
// decline treatment the customer pay sheet uses, so a wrong password and a
// declined card "feel" like the same kind of thing. Keyed on the message so
// a repeat failure shakes again. Reduced motion keeps only the fade (the
// root MotionConfig strips the transform keyframes).
export function FormError({ children }: { children?: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {children && (
        <motion.div
          key={String(children)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <FormMessage tone="error">{children}</FormMessage>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
