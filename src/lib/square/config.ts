import { env } from "@/lib/env";

export type SquareEnvironment = "sandbox" | "production";

export function squareEnvironment(): SquareEnvironment {
  const value = env.squareEnv();
  if (value !== "sandbox" && value !== "production") {
    throw new Error(`SQUARE_ENV must be "sandbox" or "production", got "${value}"`);
  }
  return value;
}

export function squareBaseUrl(environment: SquareEnvironment = squareEnvironment()): string {
  return environment === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

// Requested once at connect time — not re-negotiable per venue.
export const SQUARE_OAUTH_SCOPES = [
  "MERCHANT_PROFILE_READ",
  "PAYMENTS_WRITE",
  "PAYMENTS_WRITE_ADDITIONAL_RECIPIENTS",
  "ORDERS_WRITE",
  "ORDERS_READ",
  "ITEMS_READ",
] as const;
