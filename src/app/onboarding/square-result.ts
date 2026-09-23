// Plain module (no "use client"/"use server") so both the server pages that
// read the URL and the client wizard that reacts to it can import it.

// What the Square OAuth round trip reported when it landed the user back on
// the wizard (see /api/square/callback's onboarding flow).
export type SquareResult = { status: "success" } | { status: "error"; reason: string };

export function parseSquareResult(sp: { square?: string; reason?: string }): SquareResult | null {
  if (sp.square === "success") return { status: "success" };
  if (sp.square === "error") return { status: "error", reason: sp.reason ?? "" };
  return null;
}
