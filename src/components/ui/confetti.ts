// The one celebration: a payment landing. canvas-confetti is loaded on
// demand (never in the initial bundle) and skipped entirely when the OS asks
// for reduced motion. Colours come from the venue's accent so a red venue
// throws red confetti, not Tillz green.
export async function celebrate(colors: string[] = []) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    const { default: confetti } = await import("canvas-confetti");
    const palette = colors.length > 0 ? colors : ["#0f5c42", "#e3f0ea", "#ffffff"];
    const base = { colors: palette, disableForReducedMotion: true, zIndex: 60 };
    confetti({ ...base, particleCount: 70, spread: 70, startVelocity: 38, origin: { y: 0.62 }, scalar: 0.95 });
    setTimeout(() => {
      confetti({ ...base, particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.7 } });
      confetti({ ...base, particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.7 } });
    }, 180);
  } catch {
    // A blocked/failed import just means no confetti — the success screen
    // stands on its own.
  }
}
