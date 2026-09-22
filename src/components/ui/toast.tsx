"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { SPRING, easeOut } from "./motion";

type Tone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: Tone };
type ToastContextValue = { show: (message: string, tone?: Tone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-ink text-surface",
  error: "bg-danger text-white",
  info: "bg-surface text-ink border border-line",
};

const TONE_ICON: Record<Tone, React.ReactNode> = {
  success: (
    <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10.5l3.5 3.5L16 6" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10 5v6M10 14.5v.5" />
    </svg>
  ),
  info: null,
};

// Root provider for toasts AND for the motion library's global config: <MotionConfig
// reducedMotion="user"> makes every motion.* element drop its transform
// animations when the OS prefers reduced motion (opacity fades stay), so
// individual components don't each have to check. Mounted once in the root
// layout.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const show = useCallback((message: string, tone: Tone = "success") => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3500);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <ToastContext.Provider value={{ show }}>
        {children}
        <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 z-[100] flex flex-col items-center sm:items-end gap-2 pointer-events-none">
          <AnimatePresence initial={false}>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                role="status"
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING }}
                exit={{ opacity: 0, y: 8, scale: 0.96, transition: easeOut(0.18) }}
                className={`pointer-events-auto flex items-center gap-2.5 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium shadow-float max-w-sm ${TONE_CLASS[t.tone]}`}
              >
                {TONE_ICON[t.tone]}
                {t.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ToastContext.Provider>
    </MotionConfig>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
