import Stripe from "stripe";
import { env } from "@/lib/env";

// Pinned explicitly (matches the "stripe" npm package version in
// package.json) rather than left to the SDK default, so an npm upgrade can
// never silently change which Stripe API version this app talks to.
const STRIPE_API_VERSION = "2026-09-30.endive" as const;

let cached: Stripe | null = null;

// null whenever STRIPE_SECRET_KEY is unset — every caller treats that as
// "Stripe isn't configured" and falls back to the stub/mock path, never as
// a reason to throw.
export function getStripeClient(): Stripe | null {
  const key = env.stripeSecretKey();
  if (!key) return null;
  if (!cached) {
    cached = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  }
  return cached;
}
