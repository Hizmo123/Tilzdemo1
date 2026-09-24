import Link from "next/link";

export const metadata = { title: "Terms of Service — Tillz" };

// Structural placeholder, not binding legal text. Every substantive clause
// below is a TODO for a lawyer to draft properly — this exists so the page,
// the links to it, and the general shape of what a hospitality SaaS ToS needs
// to cover are in place before that review happens, not to stand in for it.
export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-paper text-ink">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-12">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← Tillz
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight mt-4 mb-1">
          Terms of Service
        </h1>
        <p className="text-sm text-muted mb-8">Last updated: not yet published.</p>

        <div className="rounded-[var(--radius-card)] border border-warn/40 bg-warn-soft text-warn p-4 text-sm mb-8">
          <strong>TODO: review by a lawyer.</strong> Everything below is a
          structural placeholder describing what a Terms of Service for Tillz
          needs to cover, written from the product as it actually works today.
          It is not binding legal text and must not be treated as final until
          reviewed and approved by a qualified lawyer for the jurisdictions
          Tillz operates in.
        </div>

        <div className="space-y-6 text-sm text-ink-soft leading-relaxed">
          <Section title="1. What Tillz is">
            Tillz is a QR-ordering, bill-splitting and payment platform used
            by hospitality venues ("Venues") and their customers ("Guests").
            <br />
            TODO: define the parties precisely — Tillz (the operator), the
            Venue (the merchant of record for food/drink sold), and the Guest.
          </Section>
          <Section title="2. Accounts">
            TODO: who may create a Venue account, minimum age, accuracy of
            information provided, responsibility for staff logins issued
            under a Venue's account, and grounds for suspension or
            termination.
          </Section>
          <Section title="3. Payments and fees">
            TODO: Tillz is a technology provider; the Venue is the merchant of
            record for orders paid through Tillz. Describe the platform fee
            structure, when card surcharges apply, refund handling, and that
            Tillz does not hold Venue funds when using a direct-to-venue
            payment processor (Stripe Connect / Square).
          </Section>
          <Section title="4. Subscription billing">
            TODO: plan tiers, billing cycle, trial terms, what happens on a
            failed payment or lapsed subscription (see the Privacy Policy and
            in-app documentation for the current behaviour: existing service
            keeps running through a grace period; new ordering is disabled
            only after that grace period lapses).
          </Section>
          <Section title="5. Acceptable use">
            TODO: prohibited conduct (fraud, abuse of the platform, excessive
            automated requests against public ordering links, etc).
          </Section>
          <Section title="6. Availability and liability">
            TODO: no guarantee of uninterrupted service, limitation of
            liability, and the support escalation path (see{" "}
            <Link href="/support" className="text-pine hover:underline">
              Support
            </Link>
            ) for what to do if service is down during trade.
          </Section>
          <Section title="7. Data and privacy">
            See the{" "}
            <Link href="/privacy" className="text-pine hover:underline">
              Privacy Policy
            </Link>{" "}
            for what is collected and why.
          </Section>
          <Section title="8. Changes to these terms">
            TODO: how Venues and Guests are notified of material changes.
          </Section>
          <Section title="9. Governing law">
            TODO: Tillz is built for Australian venues — confirm governing
            law and jurisdiction with a lawyer.
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-base font-semibold tracking-tight text-ink mb-1.5">
        {title}
      </h2>
      <p>{children}</p>
    </section>
  );
}
