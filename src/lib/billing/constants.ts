// audit() (src/lib/audit.ts) requires an actorUserId/actorEmail — every
// existing call site has a real signed-in user to attribute the action to.
// A Stripe webhook delivery doesn't: it's Stripe's server calling ours, with
// no Tillz user in the loop. These sentinels make that visible in the audit
// log (`billing.stripe_synced` entries) rather than attributing a webhook-
// driven plan change to whichever user happened to be in a closure, or
// faking a real user id.
export const STRIPE_WEBHOOK_ACTOR_USER_ID = "system:stripe-webhook";
export const STRIPE_WEBHOOK_ACTOR_EMAIL = "stripe-webhook@system.local";
