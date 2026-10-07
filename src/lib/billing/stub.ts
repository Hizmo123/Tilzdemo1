import { env } from "@/lib/env";
import type {
  BillingProvider,
  CreateCheckoutSessionInput,
  CreatePortalSessionInput,
  HandleWebhookEventInput,
  CheckoutSessionResult,
  PortalSessionResult,
  WebhookHandleResult,
  SyncExtraVenueQuantityInput,
  SyncExtraVenueQuantityResult,
} from "./provider";

const NOT_CONFIGURED = "Billing isn't configured yet — set STRIPE_SECRET_KEY to enable real checkout.";

// No Stripe SDK import, no network calls — this is purely the "nothing is
// wired up yet" branch every real provider call site already needs, pulled
// out so it's the SAME branch everywhere instead of each caller re-checking
// env.stripeSecretKey() itself. src/lib/billing/index.ts returns this until a
// real StripeBillingProvider exists to swap in.
export class StubBillingProvider implements BillingProvider {
  readonly name = "stub";

  private configured(): boolean {
    return !!env.stripeSecretKey();
  }

  async createCheckoutSession(_input: CreateCheckoutSessionInput): Promise<CheckoutSessionResult> {
    if (!this.configured()) return { configured: false, error: NOT_CONFIGURED };
    // Unreachable until a real provider replaces this stub (configured() can
    // only be true here if STRIPE_SECRET_KEY is set, but this class never
    // calls Stripe regardless) — kept as an explicit dead branch rather than
    // an `as never` cast, so the shape this will need to return is visible.
    return { configured: false, error: NOT_CONFIGURED };
  }

  async createPortalSession(_input: CreatePortalSessionInput): Promise<PortalSessionResult> {
    if (!this.configured()) return { configured: false, error: NOT_CONFIGURED };
    return { configured: false, error: NOT_CONFIGURED };
  }

  async handleWebhookEvent(_input: HandleWebhookEventInput): Promise<WebhookHandleResult> {
    if (!this.configured()) return { configured: false, error: NOT_CONFIGURED };
    return { configured: false, error: NOT_CONFIGURED };
  }

  async syncExtraVenueQuantity(_input: SyncExtraVenueQuantityInput): Promise<SyncExtraVenueQuantityResult> {
    // No subscription to update under the mock model — the venue still gets
    // created for free, exactly as before this provider existed.
    return { configured: false };
  }
}
