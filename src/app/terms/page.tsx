import Link from "next/link";
import { LEGAL, formatLegalDate } from "@/lib/legal";
import { CONNECT_FEE_BLURB } from "@/lib/plans";
import { ACCOUNT_RETENTION_YEARS } from "@/lib/account-retention";

export const metadata = { title: "Terms of Service — Tap-to-It" };

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-paper text-ink">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-12">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← Tap-to-It
        </Link>
        <h1 className="font-display text-3xl font-semibold tracking-tight mt-4 mb-1">
          Terms of Service
        </h1>
        <p className="text-sm text-muted mb-8">
          Effective {formatLegalDate(LEGAL.termsEffective)}
        </p>

        <div className="space-y-8 text-sm text-ink-soft leading-relaxed">
          <Section title="1. Who these terms apply to">
            <p>
              These Terms of Service (<strong className="text-ink">Terms</strong>) are a legal
              agreement between {LEGAL.entityName} (ABN {LEGAL.abn}) (
              <strong className="text-ink">Tap-to-It</strong>, <strong className="text-ink">we</strong>,{" "}
              <strong className="text-ink">us</strong>) and:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                a hospitality business that creates a Tap-to-It account to use the platform at
                its venue or venues (a <strong className="text-ink">Venue</strong>,{" "}
                <strong className="text-ink">you</strong>), including every owner, manager and
                staff member who uses the account; and
              </li>
              <li>
                a person who scans a Venue's QR code or NFC tag to view a menu, order, split a
                bill or pay (a <strong className="text-ink">Guest</strong>).
              </li>
            </ul>
            <p className="mt-2">
              Sections 2 to 12 apply to Venues. Section 13 applies to Guests. Sections 14 to
              18 apply to everyone. By creating an account, or by using a Tap-to-It ordering
              page, you agree to the parts of these Terms that apply to you.
            </p>
          </Section>

          <Section title="2. What Tap-to-It is">
            <p>
              Tap-to-It is software. It lets a Venue publish a digital menu, take orders from
              tables via QR codes or NFC tags, route those orders to a kitchen screen, and
              let Guests split and pay their bill from their own phone.
            </p>
            <p className="mt-2">
              Tap-to-It is not a restaurant, a payment processor or a bank. When a Guest orders
              food or drink through Tap-to-It, the sale is between the Guest and the Venue. The
              Venue is the seller and the merchant of record. Tap-to-It provides the technology
              that carries the order and the payment instruction.
            </p>
          </Section>

          <Section title="3. Venue accounts">
            <p>
              To create a Venue account you must be at least 18 years old, be authorised to
              bind the business you are registering, and be operating a business in
              Australia with a valid Australian Business Number. We verify the ABN you
              provide against the Australian Business Register and may refuse or suspend an
              account whose ABN cannot be verified.
            </p>
            <p className="mt-2">
              You are responsible for everything done under your account, including by
              staff you invite and by floor or kitchen staff using a shared-terminal PIN.
              Keep sign-in details and PINs confidential, remove access for people who
              leave, and tell us promptly at{" "}
              <a href={`mailto:${LEGAL.supportEmail}`} className="text-pine hover:underline">
                {LEGAL.supportEmail}
              </a>{" "}
              if you believe your account has been accessed without authority.
            </p>
            <p className="mt-2">
              You must keep the information in your account (venue name, address, ABN,
              contact details, menu prices, allergen and dietary information) accurate and
              current. Guests rely on it.
            </p>
          </Section>

          <Section title="4. Plans, fees and billing">
            <p>
              Tap-to-It offers two ways to pay for the service. The plan you choose is shown in
              your dashboard under Billing, and the current features and prices of every
              plan are published on our pricing page. The pricing page forms part of these
              Terms.
            </p>
            <h3 className="text-ink font-medium mt-3 mb-1">Subscription plans</h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Subscription plans are billed monthly in advance in Australian dollars.
                Prices shown are inclusive of GST.
              </li>
              <li>
                Paid subscription plans start with a 14-day free trial. You will not be
                charged during the trial. At the end of the trial, your subscription starts
                and the monthly fee is charged unless you have cancelled or moved to the
                free plan before the trial ends.
              </li>
              <li>
                Subscriptions renew automatically each month until cancelled. You can cancel
                or change plan at any time from Billing in your dashboard. Cancellation
                takes effect at the end of the current billing month; you keep access until
                then. We do not refund part-months, except where the law requires it.
              </li>
              <li>
                If a subscription payment fails, we will notify you and keep your service
                running during a grace period while we retry. If payment has not been
                received when the grace period ends, live ordering is switched off until it
                is. Guests with an open bill can still pay and receive a receipt. Your data
                is not deleted because of a lapsed payment.
              </li>
              <li>
                When you move to a lower plan, tables, kitchen stations and venues you have
                already set up are not removed. Features the lower plan does not include
                simply stop being available.
              </li>
            </ul>
            <h3 className="text-ink font-medium mt-3 mb-1">Pay as you sell (Connect)</h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Pay as you sell (shown as Connect in your dashboard) has no monthly subscription. Instead, Tap-to-It charges a platform
                fee of {CONNECT_FEE_BLURB}, on each order paid through Tap-to-It. The fee is
                deducted automatically from the payment as it settles to your Square account.
              </li>
              <li>
                Pay as you sell requires an active Square account that you own and that you
                have authorised Tap-to-It to connect to. Square's own terms, fees and payout
                timing apply to your Square account and are separate from these Terms.
              </li>
              <li>
                If you disconnect your Square account, Pay as you sell ordering stops until it
                is reconnected. Tap-to-It never holds your funds: payments made by Guests settle
                directly to your Square account.
              </li>
              <li>
                Optional add-ons for Pay as you sell (such as extended analytics or removal of Tap-to-It
                branding) are billed monthly at the prices shown on the pricing page and can
                be cancelled at any time.
              </li>
            </ul>
            <h3 className="text-ink font-medium mt-3 mb-1">Price changes</h3>
            <p>
              We may change our prices. We will give you at least 30 days' notice by email
              before a price change takes effect on your plan. If you do not agree to the
              new price you may cancel before it takes effect and you will not be charged
              the new price.
            </p>
          </Section>

          <Section title="5. Orders and payments between Venues and Guests">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                The Venue sets its own menu, prices, surcharges, opening hours and whether
                ordering is switched on. Tap-to-It shows Guests what the Venue has entered.
              </li>
              <li>
                Card details entered by Guests are captured by the payment provider's own
                secure form and never pass through or are stored on Tap-to-It's servers.
              </li>
              <li>
                Refunds, disputes, chargebacks and complaints about food, drink or service
                are matters between the Venue and the Guest. The Venue must handle them in
                accordance with the Australian Consumer Law. Tap-to-It will provide order and
                payment records to help resolve a dispute on request.
              </li>
              <li>
                The Venue is solely responsible for complying with all laws that apply to
                selling its products, including liquor licensing, responsible service of
                alcohol, food safety and allergen disclosure. Tap-to-It does not verify the age
                of Guests. If you sell age-restricted products, you must verify age at the
                table before serving, regardless of what was ordered through Tap-to-It.
              </li>
              <li>
                The Venue is responsible for issuing a compliant tax invoice where one is
                required. Tap-to-It's receipt emails are provided to help with this but the
                Venue must ensure its business details on the receipt are correct.
              </li>
            </ul>
          </Section>

          <Section title="6. Physical products (Tap-to-It stands)">
            <p>
              You can order physical QR stands, cards and A-frames from Tap-to-It through your
              dashboard. These are goods sold by Tap-to-It to you and are shipped within
              Australia only.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                Prices are shown in Australian dollars inclusive of GST and are charged when
                you place the order.
              </li>
              <li>
                Each stand is printed with a QR code unique to your venue. Because the
                product is customised, it cannot be resold, so we do not accept change-of-mind
                returns. This does not affect your rights under the Australian Consumer Law
                if a product is faulty, damaged in transit or not as described: contact us
                and we will replace it or refund you.
              </li>
              <li>
                If you upload your own artwork, you confirm that you own it or have the right
                to use it, and that it does not infringe anyone else's rights or contain
                unlawful content. You grant Tap-to-It a licence to reproduce it for the sole
                purpose of manufacturing your order. We may decline to print artwork that
                does not meet our published guidelines or that we reasonably consider
                unlawful or offensive, and will refund any order we decline.
              </li>
              <li>
                Delivery times shown at checkout are estimates. We will tell you if an order
                is delayed.
              </li>
            </ul>
          </Section>

          <Section title="7. Your content">
            <p>
              You keep ownership of everything you put into Tap-to-It: your menu, photos, logo,
              venue name and descriptions (<strong className="text-ink">Venue Content</strong>).
              You grant Tap-to-It a non-exclusive, royalty-free, worldwide licence to host,
              copy, display and transmit Venue Content for the purpose of providing the
              service to you and your Guests, and for no other purpose. The licence ends
              when the content is deleted from Tap-to-It, except for copies retained in backups
              or as required by section 11.
            </p>
            <p className="mt-2">
              You are responsible for Venue Content. It must be accurate, must not infringe
              anyone's intellectual property, and must not be misleading, defamatory or
              unlawful.
            </p>
          </Section>

          <Section title="8. Acceptable use">
            <p>You must not, and must not allow anyone using your account to:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>use Tap-to-It for anything unlawful, fraudulent or deceptive;</li>
              <li>
                place orders or payments that you know to be fraudulent, or use Tap-to-It to
                launder money or evade tax;
              </li>
              <li>
                attempt to access another Venue's data, another user's account, or any part
                of Tap-to-It you are not authorised to access;
              </li>
              <li>
                probe, scan or test the vulnerability of Tap-to-It, interfere with its operation,
                or send automated requests to ordering pages at a volume that a person could
                not;
              </li>
              <li>
                copy, resell, sublicense or reverse-engineer the Tap-to-It software, or remove
                Tap-to-It branding except where your plan includes that feature;
              </li>
              <li>
                use Tap-to-It to send unsolicited commercial messages in breach of the{" "}
                <em>Spam Act 2003</em> (Cth).
              </li>
            </ul>
          </Section>

          <Section title="9. Availability, support and changes to the service">
            <p>
              We work to keep Tap-to-It available at all times but we do not promise
              uninterrupted or error-free operation. Tap-to-It depends on third-party
              infrastructure, payment providers and the internet, all of which can fail. We
              recommend every Venue keeps a way to take orders and payments that does not
              depend on Tap-to-It.
            </p>
            <p className="mt-2">
              Support is provided by email at{" "}
              <a href={`mailto:${LEGAL.supportEmail}`} className="text-pine hover:underline">
                {LEGAL.supportEmail}
              </a>{" "}
              and through the{" "}
              <Link href="/support" className="text-pine hover:underline">
                Support
              </Link>{" "}
              page. Where a plan includes priority support, we aim to respond to those
              requests first.
            </p>
            <p className="mt-2">
              We may add, change or remove features. If a change materially reduces what
              your plan includes, we will give you at least 30 days' notice and you may
              cancel without penalty before it takes effect.
            </p>
          </Section>

          <Section title="10. Suspension and termination">
            <p>
              You can close your account at any time from Settings in your dashboard. The
              closure process explains what happens to your data and requires you to
              confirm by typing your venue name. Closure ends your subscription; no further
              subscription fees are charged after the current billing month.
            </p>
            <p className="mt-2">
              We may suspend or terminate your account if you materially breach these Terms
              (including non-payment beyond the grace period, or a breach of section 8),
              if we are required to by law, or if continuing would create a genuine
              security or legal risk. Except where the breach is serious or urgent, we will
              tell you what the problem is and give you a reasonable opportunity to fix it
              first.
            </p>
            <p className="mt-2">
              We may also discontinue Tap-to-It altogether. If we do, we will give you at least
              60 days' notice and a way to export your data.
            </p>
          </Section>

          <Section title="11. Data after your account closes">
            <p>
              Paid bills are financial records. Australian tax law requires them to be
              kept for five years. When your account is closed, Tap-to-It stops providing the
              service immediately, but bill, payment and receipt records are retained for{" "}
              {ACCOUNT_RETENTION_YEARS} years from the date of closure and then permanently
              deleted. Menu content, images and other operational data are deleted with the
              account. See the{" "}
              <Link href="/privacy" className="text-pine hover:underline">
                Privacy Policy
              </Link>{" "}
              for detail. You can export your data from Settings before you close your
              account.
            </p>
          </Section>

          <Section title="12. Privacy obligations of Venues">
            <p>
              When Guests use Tap-to-It at your venue, Tap-to-It collects a small amount of
              personal information on your behalf (for example a name for an order, or an
              email address for a receipt). Tap-to-It handles that information as set out in
              our Privacy Policy. You are separately responsible for your own obligations
              under the <em>Privacy Act 1988</em> (Cth) in respect of your customers, and
              you must not use Guest information obtained through Tap-to-It for marketing
              unless the Guest has agreed to that.
            </p>
          </Section>

          <Section title="13. Guests">
            <p>
              You do not need an account to use a Tap-to-It ordering page. By ordering or
              paying through Tap-to-It you agree to this section.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                Your order is a contract with the Venue, not with Tap-to-It. The Venue is
                responsible for preparing what you ordered, for its quality and for
                handling any refund or complaint. Tap-to-It will help the Venue with order
                records if you raise a dispute.
              </li>
              <li>
                Prices, availability, surcharges and allergen information are entered by
                the Venue. If something is wrong or you have a dietary or allergy
                requirement, ask the Venue's staff before you order.
              </li>
              <li>
                Card payments are processed by the Venue's payment provider. Tap-to-It does not
                see or store your card number.
              </li>
              <li>
                If you split a bill with others at your table, each person is responsible
                for the amount they choose to pay. Tap-to-It does not pursue anyone for an
                unpaid balance; that is between you and the Venue.
              </li>
              <li>
                You must not use an ordering page to place orders you do not intend to pay
                for, to interfere with a Venue's service, or in any way described in
                section 8.
              </li>
              <li>
                If you are under 18, you may use Tap-to-It to order, but the Venue will not
                serve you age-restricted products.
              </li>
            </ul>
          </Section>

          <Section title="14. Intellectual property">
            <p>
              Tap-to-It, its software, design, name and logo are owned by us or our licensors.
              Nothing in these Terms transfers any of that to you. You may use Tap-to-It only as
              these Terms allow. If you give us feedback or suggestions, we can use them
              without any obligation to you.
            </p>
          </Section>

          <Section title="15. Australian Consumer Law and our liability">
            <p>
              Our services and goods come with guarantees that cannot be excluded under the
              Australian Consumer Law. Nothing in these Terms excludes, restricts or
              modifies any right or remedy you have under that law or any other law that
              cannot be excluded by agreement.
            </p>
            <p className="mt-2">
              Where the law allows us to limit our liability for a failure to comply with a
              consumer guarantee in relation to services, our liability is limited, at our
              option, to supplying the services again or paying the cost of having them
              supplied again. For goods, it is limited to replacing the goods, repairing
              them, or paying the cost of doing so.
            </p>
            <p className="mt-2">
              Subject to the above, and to the fullest extent permitted by law:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>
                we are not liable for loss of revenue, profit, goodwill or data, or for
                indirect or consequential loss, arising from your use of or inability to
                use Tap-to-It, including downtime during trading hours;
              </li>
              <li>
                we are not liable for the acts or omissions of Venues, Guests, or third
                party providers such as payment processors and hosting providers;
              </li>
              <li>
                our total liability to you in connection with Tap-to-It in any 12-month period
                is limited to the fees you paid us in that period.
              </li>
            </ul>
            <p className="mt-2">
              Each party's liability is reduced to the extent that its loss was caused or
              contributed to by the other party.
            </p>
          </Section>

          <Section title="16. Changes to these terms">
            <p>
              We may update these Terms. For changes that affect your rights or
              obligations, we will give Venues at least 30 days' notice by email to the
              address on the account before the change takes effect, and you may cancel
              before then if you do not accept it. Minor changes (such as corrections or
              clarifications) take effect when published. The effective date at the top of
              this page always shows the version in force. Continued use after the
              effective date is acceptance of the updated Terms.
            </p>
          </Section>

          <Section title="17. General">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-ink">Governing law.</strong> These Terms are governed
                by the laws of {LEGAL.governingState}, Australia. Each party submits to the
                non-exclusive jurisdiction of the courts of {LEGAL.governingState} and the
                Commonwealth of Australia.
              </li>
              <li>
                <strong className="text-ink">Disputes.</strong> If you have a problem, tell us
                first. We will try to resolve it with you in good faith before either party
                starts proceedings. This does not stop either party seeking urgent relief
                from a court.
              </li>
              <li>
                <strong className="text-ink">Notices.</strong> We will send notices to the
                email address on your account. You can send notices to us at{" "}
                <a href={`mailto:${LEGAL.supportEmail}`} className="text-pine hover:underline">
                  {LEGAL.supportEmail}
                </a>{" "}
                or by post to {LEGAL.address}.
              </li>
              <li>
                <strong className="text-ink">Assignment.</strong> You may not transfer your
                account or these Terms without our written consent. We may transfer our
                rights and obligations to a successor business (for example, if Tap-to-It is
                restructured into a company) provided your rights are not reduced.
              </li>
              <li>
                <strong className="text-ink">Severance.</strong> If any part of these Terms is
                unenforceable, the rest continues to apply.
              </li>
              <li>
                <strong className="text-ink">Entire agreement.</strong> These Terms, the pricing
                page and the Privacy Policy are the whole agreement between you and Tap-to-It
                about the service.
              </li>
            </ul>
          </Section>

          <Section title="18. Contact">
            <p>
              {LEGAL.entityName}
              <br />
              ABN {LEGAL.abn}
              <br />
              {LEGAL.address}
              <br />
              <a href={`mailto:${LEGAL.supportEmail}`} className="text-pine hover:underline">
                {LEGAL.supportEmail}
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
