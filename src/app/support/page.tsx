import Link from "next/link";

export const metadata = { title: "Support — Tillz" };

// Contact details come from env so nothing fake ships by default — same
// pattern as Twilio/Resend elsewhere (see .env.example): unset means "not
// configured yet", shown plainly rather than inventing a placeholder address.
export default function SupportPage() {
  const email = process.env.SUPPORT_EMAIL?.trim();
  const phone = process.env.SUPPORT_PHONE?.trim();
  const configured = Boolean(email || phone);

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-12">
        <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
          ← Back to dashboard
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight mt-4 mb-1">
          Support
        </h1>
        <p className="text-muted mb-8">
          For venue owners, staff and guests using Tillz.
        </p>

        {configured ? (
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 space-y-3 mb-8">
            {email && (
              <p>
                <span className="block text-xs text-muted uppercase tracking-wide mb-0.5">
                  Email
                </span>
                <a href={`mailto:${email}`} className="text-pine hover:underline">
                  {email}
                </a>
              </p>
            )}
            {phone && (
              <p>
                <span className="block text-xs text-muted uppercase tracking-wide mb-0.5">
                  Phone
                </span>
                <a href={`tel:${phone}`} className="text-pine hover:underline">
                  {phone}
                </a>
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 text-amber-800 p-4 text-sm mb-8">
            Support contact details aren't configured yet — set{" "}
            <code className="bg-white/60 rounded px-1">SUPPORT_EMAIL</code> and/or{" "}
            <code className="bg-white/60 rounded px-1">SUPPORT_PHONE</code> in the
            environment.
          </div>
        )}

        <div className="space-y-6 text-sm text-ink-soft leading-relaxed">
          <Section title="Service is down right now, mid-service">
            This is the one that can't wait for a ticket queue. TODO: a real
            on-call/escalation path (a monitored number, a status page) once
            Tillz has paying venues depending on it — until then, the contact
            details above are the only channel, and there's no guaranteed
            response time.
          </Section>
          <Section title="A payment or refund looks wrong">
            Every payment and refund is tied to a real record in the
            dashboard (Bills → the bill in question shows every payment and
            any refund against it). Have the bill or table number ready when
            you get in touch.
          </Section>
          <Section title="Data, privacy, or account questions">
            See the{" "}
            <Link href="/privacy" className="text-pine hover:underline">
              Privacy Policy
            </Link>
            . Venue owners can export or request deletion of their account
            data from Settings in the dashboard.
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
