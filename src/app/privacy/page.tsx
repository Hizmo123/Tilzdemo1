import Link from "next/link";
import { LEGAL, formatLegalDate } from "@/lib/legal";
import { ACCOUNT_RETENTION_YEARS } from "@/lib/account-retention";

export const metadata = { title: "Privacy Policy — Tap-to-It" };

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-paper text-ink">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-12">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← Tap-to-It
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight mt-4 mb-1">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted mb-8">
          Effective {formatLegalDate(LEGAL.privacyEffective)}
        </p>

        <div className="space-y-8 text-sm text-ink-soft leading-relaxed">
          <Section title="1. About this policy">
            <p>
              This policy explains how {LEGAL.entityName} (ABN {LEGAL.abn}) (
              <strong className="text-ink">Tap-to-It</strong>, <strong className="text-ink">we</strong>,{" "}
              <strong className="text-ink">us</strong>) collects, uses, stores and discloses
              personal information, and how you can access or correct it or make a
              complaint. We handle personal information in accordance with the{" "}
              <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (
              <strong className="text-ink">APPs</strong>).
            </p>
            <p className="mt-2">
              Tap-to-It is used by two kinds of people, and we collect different things from
              each:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                <strong className="text-ink">Venues</strong>: the owners, managers and staff
                of hospitality businesses that have a Tap-to-It account.
              </li>
              <li>
                <strong className="text-ink">Guests</strong>: people who scan a QR code or NFC
                tag at a venue to view a menu, order or pay. Guests never need an account.
              </li>
            </ul>
            <p className="mt-2">
              When a Guest uses Tap-to-It at a venue, the venue is the business the Guest is
              dealing with. Tap-to-It holds Guest information on the venue's behalf to run the
              order and payment, and handles it as described here.
            </p>
          </Section>

          <Section title="2. What we collect from Guests">
            <p>
              You can view a menu, order and pay without giving us anything that identifies
              you. The information below is collected only if you choose to provide it or
              if the venue's setup asks for it.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                <strong className="text-ink">A name for your order</strong>, if you choose to
                give one so staff can find you.
              </li>
              <li>
                <strong className="text-ink">An email address</strong>, only if you ask for a
                copy of your receipt to be emailed to you.
              </li>
              <li>
                <strong className="text-ink">Your order and payment record</strong>: what you
                ordered, the table or counter, amounts, tip, the time, and a reference from
                the payment provider. We do not receive or store your card number, expiry
                or security code. Those are entered directly into the payment provider's
                secure form.
              </li>
              <li>
                <strong className="text-ink">Assistance requests</strong> (for example,
                asking for water or the bill): only the table and the type of request.
              </li>
              <li>
                <strong className="text-ink">Technical information</strong> needed to serve the
                page: your IP address, browser type and the time of the request, held in
                short-lived server logs, and a session token stored in your browser so your
                table's bill stays attached to your phone while you are at the venue.
              </li>
            </ul>
            <p className="mt-2">
              We do not use advertising trackers, third-party analytics scripts or social
              media pixels on Guest pages.
            </p>
          </Section>

          <Section title="3. What we collect from Venues">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-ink">Account details</strong>: the name and email
                address used to sign in. If you sign in with Google, we receive your name,
                email address and Google account identifier from Google; we do not receive
                your Google password.
              </li>
              <li>
                <strong className="text-ink">Business details</strong>: venue name, address,
                ABN, contact phone number, and the business name returned by the Australian
                Business Register when we verify your ABN.
              </li>
              <li>
                <strong className="text-ink">Staff details</strong>: for people you invite,
                their name and email address; for floor and kitchen staff using a shared
                terminal, a display name and a PIN. PINs are stored only as a one-way hash.
                We cannot read them.
              </li>
              <li>
                <strong className="text-ink">Venue content</strong>: your menu, prices,
                photos, logo and settings.
              </li>
              <li>
                <strong className="text-ink">Billing information</strong>: your plan, billing
                history and invoices. Subscription card payments are processed by our
                payment provider, which stores your card details. We do not store your
                full card number.
              </li>
              <li>
                <strong className="text-ink">Square connection</strong> (Pay as you sell only):
                when you connect your Square account, Square gives us access tokens for your
                account and your Square merchant and location identifiers. Tokens are stored
                encrypted and are used only to create orders and payments on your behalf.
                We can see the orders and payments Tap-to-It created in your Square account; we
                do not access the rest of it.
              </li>
              <li>
                <strong className="text-ink">Stand orders</strong>: the recipient name and
                delivery address for physical products you order, and any artwork you
                upload.
              </li>
              <li>
                <strong className="text-ink">Support correspondence</strong>: emails you send
                us and our replies.
              </li>
              <li>
                <strong className="text-ink">Technical and security information</strong>: IP
                address, browser, sign-in times, and an audit trail of significant actions
                taken in your account (for example, changing plan, exporting data or
                closing the account) so that we can investigate problems and unauthorised
                access.
              </li>
            </ul>
          </Section>

          <Section title="4. How we use personal information">
            <p>We use personal information to:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                run the service: show menus, take and route orders, process payments
                through the venue's payment provider, send receipts, and let staff run the
                floor and kitchen;
              </li>
              <li>
                manage Venue accounts, including verifying ABNs, billing, sending invoices
                and notifying you about payment problems or changes to the service;
              </li>
              <li>
                manufacture and deliver physical products you order;
              </li>
              <li>
                provide support and respond to requests, complaints and disputes;
              </li>
              <li>
                keep the service secure, detect fraud and abuse, and investigate incidents;
              </li>
              <li>
                produce reports and analytics for a venue about its own trading. These use
                the venue's order data. We do not sell or share one venue's data with
                another;
              </li>
              <li>
                meet our legal obligations, including tax record-keeping.
              </li>
            </ul>
            <p className="mt-2">
              We send Venues service emails that are part of running the account (receipts,
              invoices, payment failures, security notices, changes to terms). We will only
              send marketing emails to a Venue with consent, and every marketing email will
              include a way to unsubscribe. We do not send marketing to Guests. A receipt
              email sent at a Guest's request is a transactional message, not marketing.
            </p>
          </Section>

          <Section title="5. Who we share it with">
            <p>
              We do not sell personal information. We share it only with the providers we
              need to run Tap-to-It, each of which is bound to use it only for the service they
              provide to us:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                <strong className="text-ink">Supabase</strong>: database, authentication and
                file storage. Hosted in {LEGAL.hostingRegion}.
              </li>
              <li>
                <strong className="text-ink">Vercel</strong>: application hosting. Our
                application runs in Sydney, Australia. Vercel's network delivers pages
                through servers around the world and keeps short-lived request logs, which
                may be processed outside Australia.
              </li>
              <li>
                <strong className="text-ink">Resend</strong>: sends receipt and account emails
                on our behalf. Resend is based in the United States; the email address and
                the content of the email pass through its systems to be delivered.
              </li>
              <li>
                <strong className="text-ink">Square</strong> (for Venues on Pay as you sell):
                receives order and payment details to process the payment into the Venue's
                own Square account. Square operates in Australia through Square AU Pty Ltd
                and processes data in the United States under its own privacy policy.
              </li>
              <li>
                <strong className="text-ink">Our subscription payment provider</strong>:
                receives Venue billing details to charge subscription fees.
              </li>
              <li>
                <strong className="text-ink">Google</strong>: if you choose to sign in with
                Google.
              </li>
              <li>
                <strong className="text-ink">Australian Business Register</strong>: we send
                the ABN you enter to the ABR to verify it.
              </li>
              <li>
                <strong className="text-ink">Print and delivery partners</strong>: the recipient
                name and delivery address for physical products you order.
              </li>
            </ul>
            <p className="mt-2">
              We will also disclose personal information where the law requires it, for
              example to respond to a lawful request from a court, regulator or law
              enforcement, and to a successor business if Tap-to-It is sold or restructured,
              on terms that continue to protect it.
            </p>
            <p className="mt-2">
              <strong className="text-ink">The venue you are ordering from</strong> can see the
              order and payment information for its own venue, including any name or
              receipt email you gave. The venue is responsible for how it uses
              that information under its own privacy obligations.
            </p>
          </Section>

          <Section title="6. Overseas disclosure">
            <p>
              Our database and files are stored in Australia. Some providers listed above
              (Resend, Square, Vercel's network and Google) process limited information in
              the United States or other countries as part of delivering emails,
              processing payments, serving pages or authenticating sign-in. Before
              disclosing personal information overseas we take reasonable steps to ensure
              the recipient handles it in a way consistent with the APPs, including by
              choosing providers with recognised security standards and contractual
              commitments about data handling.
            </p>
          </Section>

          <Section title="7. How long we keep it">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-ink">Paid bills, payments and receipts</strong>: a
                paid bill is a financial record that Australian tax law requires businesses
                to keep for five years. We keep these records, including any name or
                email attached to them, for {ACCOUNT_RETENTION_YEARS} years from
                the date the venue's account is closed, then permanently delete them.
              </li>
              <li>
                <strong className="text-ink">Unpaid or abandoned orders and assistance
                requests</strong>: kept only as long as they are useful for running the
                venue, then removed.
              </li>
              <li>
                <strong className="text-ink">Venue account, menu, images and settings</strong>:
                kept while the account is open. Deleted when the account is closed.
              </li>
              <li>
                <strong className="text-ink">Square tokens</strong>: deleted immediately when
                you disconnect Square or close your account.
              </li>
              <li>
                <strong className="text-ink">Server logs</strong>: kept for a short period for
                security and troubleshooting, then automatically removed.
              </li>
              <li>
                <strong className="text-ink">Backups</strong>: deleted data may persist in
                encrypted backups for a limited time before those backups are cycled out.
              </li>
            </ul>
          </Section>

          <Section title="8. How we protect it">
            <p>
              We take reasonable steps to protect personal information from misuse,
              interference, loss and unauthorised access. These include: encryption in
              transit for every connection; database access rules that restrict each
              venue's data to that venue; encryption of stored Square tokens; one-way
              hashing of staff PINs; never handling card numbers on our own systems;
              multi-factor authentication for Venue accounts; and an audit trail of
              sensitive account actions. No system is perfectly secure, and you should
              keep your own sign-in details and PINs confidential.
            </p>
            <p className="mt-2">
              If a data breach occurs that is likely to result in serious harm to anyone
              whose information we hold, we will notify the affected people and the Office
              of the Australian Information Commissioner as required by the Notifiable Data
              Breaches scheme.
            </p>
          </Section>

          <Section title="9. Cookies">
            <p>
              Tap-to-It uses only cookies that are necessary for the service to work. We do not
              use advertising or cross-site tracking cookies.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                <strong className="text-ink">Sign-in cookies</strong> that keep a Venue user
                signed in to the dashboard.
              </li>
              <li>
                <strong className="text-ink">A staff terminal cookie</strong> that keeps a
                floor or kitchen screen signed in on a shared device.
              </li>
              <li>
                <strong className="text-ink">A venue selection cookie</strong> that remembers
                which venue a multi-venue account is viewing.
              </li>
              <li>
                <strong className="text-ink">Square connection cookies</strong>, lasting 10
                minutes, used only while a Venue is connecting its Square account, to keep
                the connection request secure.
              </li>
              <li>
                <strong className="text-ink">A plan selection cookie</strong>, lasting up to
                one hour, that remembers the plan chosen during sign-up until the account is
                confirmed.
              </li>
            </ul>
            <p className="mt-2">
              We also use your browser's local storage on your own device to remember small
              things that make the service work, such as the items in a Guest's cart, a
              dashboard layout preference, or whether a one-off welcome animation has
              already been shown. This information stays on your device and is not used
              for tracking or advertising.
            </p>
            <p className="mt-2">
              You can block or delete cookies and stored data in your browser settings, but
              the dashboard and ordering pages will not work without them.
            </p>
          </Section>

          <Section title="10. Access, correction and deletion">
            <p>
              You can ask us for access to the personal information we hold about you, or
              ask us to correct it, by emailing{" "}
              <a href={`mailto:${LEGAL.privacyEmail}`} className="text-pine hover:underline">
                {LEGAL.privacyEmail}
              </a>
              . We will respond within 30 days. We may need to verify your identity first.
              There is no charge for making a request; if a request is complex we may
              charge a reasonable fee for the time involved, and we will tell you before we
              do.
            </p>
            <p className="mt-2">
              <strong className="text-ink">Venues</strong> can export all of their venue's data
              and close their account themselves from Settings in the dashboard, without
              contacting us. Closing the account deletes the venue's data, subject to the
              five-year retention of financial records described in section 7.
            </p>
            <p className="mt-2">
              <strong className="text-ink">Guests</strong> who want a name or email
              removed from an order record can ask the venue directly or contact us.
              We can remove those details from the record while keeping the financial
              record itself, which the venue is required by law to retain.
            </p>
          </Section>

          <Section title="11. Complaints">
            <p>
              If you believe we have mishandled your personal information, please contact
              us at{" "}
              <a href={`mailto:${LEGAL.privacyEmail}`} className="text-pine hover:underline">
                {LEGAL.privacyEmail}
              </a>{" "}
              or by post to {LEGAL.address}. We will acknowledge your complaint within 7
              days, investigate it, and respond within 30 days. If you are not satisfied
              with our response you can complain to the Office of the Australian
              Information Commissioner at{" "}
              <a
                href="https://www.oaic.gov.au"
                className="text-pine hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                oaic.gov.au
              </a>{" "}
              or on 1300 363 992.
            </p>
          </Section>

          <Section title="12. Children">
            <p>
              Guests of any age can view a menu or order through Tap-to-It because a venue's
              ordering page is part of the venue's service to its customers. We do not
              knowingly collect personal information from a person under 18 beyond what is
              needed to complete their order, and venues remain responsible for not serving
              age-restricted products to minors. Venue accounts may only be created by
              adults.
            </p>
          </Section>

          <Section title="13. Changes to this policy">
            <p>
              We may update this policy as the service or the law changes. The effective
              date at the top shows the version in force. If a change materially affects
              how we handle personal information, we will notify Venues by email before it
              takes effect. The current version is always available at this address.
            </p>
          </Section>

          <Section title="14. Contact">
            <p>
              {LEGAL.entityName}
              <br />
              ABN {LEGAL.abn}
              <br />
              {LEGAL.address}
              <br />
              <a href={`mailto:${LEGAL.privacyEmail}`} className="text-pine hover:underline">
                {LEGAL.privacyEmail}
              </a>
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-base font-semibold tracking-tight text-ink mb-2">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}
