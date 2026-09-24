import Link from "next/link";

export const metadata = { title: "Privacy Policy — Tillz" };

// The "what we collect / where / how long" section below is factual — it
// describes what the system actually does, not aspirational copy — so it
// doesn't need a lawyer to be accurate. The framing around it (rights,
// obligations, binding commitments) does, and is marked TODO throughout.
// This is not final legal text.
export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-paper text-ink">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-12">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← Tillz
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight mt-4 mb-1">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted mb-8">Last updated: not yet published.</p>

        <div className="rounded-[var(--radius-card)] border border-warn/40 bg-warn-soft text-warn p-4 text-sm mb-8">
          <strong>TODO: review by a lawyer.</strong> The data inventory below
          reflects what Tillz actually stores today. The surrounding legal
          framing (your rights, our obligations, how disputes are handled) is
          a structural placeholder and must not be treated as final until
          reviewed for the Australian Privacy Act and any other jurisdiction
          Tillz operates in.
        </div>

        <div className="space-y-6 text-sm text-ink-soft leading-relaxed">
          <Section title="What we collect, and why">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-ink">Guest ordering a table's bill:</strong>{" "}
                nothing that identifies you is required to order or pay. If you
                choose to add an email to receive a copy of your receipt,
                that's stored against the bill.
              </li>
              <li>
                <strong className="text-ink">Guest requesting assistance</strong>{" "}
                (water, cutlery, the bill) from the table screen: only the
                table and request type — no personal details.
              </li>
              <li>
                <strong className="text-ink">Venue owner/staff:</strong> the
                email used to sign in (via Supabase Auth), and for floor/kitchen
                staff using a shared-terminal PIN, a name and a hashed PIN —
                never the PIN itself in readable form.
              </li>
              <li>
                <strong className="text-ink">Venue owner phone verification:</strong>{" "}
                a mobile number and a short-lived one-time code, used once to
                confirm the owner controls that number.
              </li>
              <li>
                <strong className="text-ink">Payments:</strong> card details
                never reach Tillz's servers. TODO once live processors are
                connected: confirm this statement still holds for both Stripe
                (Payment Element, tokenised client-side) and Square (Web
                Payments SDK, tokenised client-side) — it's the intended
                architecture, not yet live.
              </li>
            </ul>
          </Section>

          <Section title="How long we keep it">
            <p className="mb-2">
              A paid bill is a tax invoice. Australian tax law requires
              businesses to keep records like this for five years, so Tillz
              retains bill, payment and receipt data — including any name,
              phone or email attached to it — for at least that long on the
              Venue's behalf, even if the Venue later asks for their account
              to be closed.
            </p>
            <p>
              Everything else (an assistance request, an unpaid draft order)
              is only kept as long as it's useful for running the venue.
            </p>
          </Section>

          <Section title="Where it's stored">
            Tillz's database and file storage run on Supabase, hosted in
            Australia (ap-southeast-2). TODO: confirm and state this precisely
            once infrastructure is finalised, including any subprocessor
            (email, payment providers) that sees a slice of this data to do
            its job (Resend for email, Stripe/Square for payments).
          </Section>

          <Section title="Your rights">
            TODO: Australian Privacy Act rights (access, correction) and how a
            Venue owner or a Guest exercises them — see{" "}
            <Link href="/support" className="text-pine hover:underline">
              Support
            </Link>{" "}
            in the meantime. A Venue owner can request an export or deletion
            of their venue's account data from Settings in the dashboard.
          </Section>

          <Section title="Changes to this policy">
            TODO: how Venues and Guests are notified of material changes.
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
      <div>{children}</div>
    </section>
  );
}
