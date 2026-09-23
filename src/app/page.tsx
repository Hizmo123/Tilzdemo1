import Link from "next/link";
import { PLANS, planPriceLabel, type PlanDef } from "@/lib/plans";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingNav } from "@/components/marketing/nav";
import { Reveal, RevealGroup, RevealItem } from "@/components/marketing/reveal";
import { SplitCheck } from "@/components/marketing/split-check";

// Public marketing site. Honest scope: it only names what the product actually
// does today (order, split, pay, staff terminal, kitchen) — no POS/loyalty
// claims that aren't built, and no fabricated uplift statistics.
//
// Visual language is the Phase 0 system (type scale, radius, elevation,
// motion) shared with the customer /v pages, so a visitor who goes from the
// hero to a scanned table sees one product, not two.

const CONTAINER = "max-w-6xl mx-auto px-5 sm:px-8";

function Hero() {
  return (
    <section className={`${CONTAINER} pt-14 pb-16 sm:pt-20 sm:pb-24 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center`}>
      <Reveal>
        <h1 className="font-display text-display-lg sm:text-display-xl font-semibold">
          Let your table order, split and pay by themselves.
        </h1>
        <p className="mt-5 text-lg text-ink-soft max-w-md">
          Your customers scan a QR code, order from your menu, split the bill any
          way they like, and pay from their phone. No app to download, no waiting
          for the check.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <LinkButton href="/signup" size="lg">
            Set up your venue
          </LinkButton>
          <LinkButton href="#how" variant="secondary" size="lg">
            See how it works
          </LinkButton>
        </div>
        <p className="mt-4 text-sm text-muted">
          Free to start. Set it up yourself in an afternoon — no sales call.
        </p>
      </Reveal>
      <Reveal delay={0.15}>
        <SplitCheck />
      </Reveal>
    </section>
  );
}

function How() {
  const steps = [
    {
      n: 1,
      title: "Put a QR code on each table",
      body: "Add your tables in the dashboard and print the codes. Each one opens straight to that table — no setup for the customer.",
    },
    {
      n: 2,
      title: "Customers order from their phone",
      body: "They scan, browse your menu with photos and options, and send their order. It lands on your kitchen screen and their running tab at once.",
    },
    {
      n: 3,
      title: "They split and pay, and leave",
      body: "Split equally, by items, or a custom amount. Everyone pays their share from their own phone. The table clears itself.",
    },
  ];
  return (
    <section id="how" className="bg-surface border-y border-line scroll-mt-16">
      <div className={`${CONTAINER} py-16 sm:py-20`}>
        <Reveal>
          <h2 className="font-display text-display font-semibold">How it works</h2>
        </Reveal>
        <RevealGroup className="mt-10 grid md:grid-cols-3 gap-8" each={0.12}>
          {steps.map((s) => (
            <RevealItem key={s.n}>
              <div className="w-10 h-10 rounded-pill bg-accent-gradient text-on-accent shadow-accent flex items-center justify-center font-display font-semibold">
                {s.n}
              </div>
              <h3 className="mt-4 font-display text-display-sm font-semibold">{s.title}</h3>
              <p className="mt-2 text-ink-soft">{s.body}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

function Benefits() {
  const points = [
    {
      title: "Tables clear faster",
      body: "The bill-wait disappears. Customers pay the moment they're ready instead of flagging someone down.",
    },
    {
      title: "Splitting stops being a chore",
      body: "No more one card at a time. Everyone pays their share themselves, at the same time.",
    },
    {
      title: "Staff run food, not payments",
      body: "Orders and payments handle themselves, so your team spends time on service. Staff can still take orders too, when a phone's flat.",
    },
    {
      title: "One live view of the room",
      body: "See every open table, order and payment as it happens — on the dashboard, or on a simple staff terminal with PIN logins.",
    },
  ];
  return (
    <section className={`${CONTAINER} py-16 sm:py-20`}>
      <Reveal>
        <h2 className="font-display text-display font-semibold">What it does for your venue</h2>
      </Reveal>
      <RevealGroup className="mt-10 grid sm:grid-cols-2 gap-x-10 gap-y-8">
        {points.map((p) => (
          <RevealItem key={p.title} className="border-t border-line pt-5">
            <h3 className="font-display text-display-sm font-semibold">{p.title}</h3>
            <p className="mt-2 text-ink-soft max-w-md">{p.body}</p>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}

function Positioning() {
  return (
    <section className="bg-ink text-surface">
      <div className={`${CONTAINER} py-16 sm:py-20`}>
        <Reveal>
          <h2 className="font-display text-display font-semibold">
            Built for the venue that just wants it to work
          </h2>
          <p className="mt-4 text-lg text-white/70 max-w-2xl">
            No demo to book, no quote that changes with your volume, no long
            contract. One clear price, sign up on the website, and you own your
            setup from day one.
          </p>
        </Reveal>
        <RevealGroup className="mt-10 grid sm:grid-cols-3 gap-8">
          {[
            ["Sign up online", "Create your venue, add your menu and tables, print your codes. No onboarding rep required."],
            ["One flat price", "You know what you pay before you start. No per-order surprises, no volume tiers to decode."],
            ["Yours to leave", "Your menu, your data. Month to month — stay because it works, not because you're locked in."],
          ].map(([t, b]) => (
            <RevealItem key={t}>
              <h3 className="font-display text-display-sm font-semibold">{t}</h3>
              <p className="mt-2 text-white/70">{b}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

// The tier we lead with. Growth is the plan a venue going live across the
// whole floor actually lands on — no table cap, no "Powered by Tillz" on
// their ordering page — so it's the one we mark "Most popular". Basic is the
// on-ramp, Pro is for groups.
const RECOMMENDED_TIER: PlanDef["tier"] = "GROWTH";

function PricingCard({ plan }: { plan: PlanDef }) {
  const free = plan.priceCents === 0;
  const recommended = plan.tier === RECOMMENDED_TIER;
  // Connect is free monthly but not "free" in the Lite sense — it carries a
  // per-order fee instead of a subscription, so it gets its own visual
  // treatment (an accent tint + its own badge) rather than either the
  // "Most popular" ring or Lite's quiet/muted card.
  const connect = plan.tier === "CONNECT";
  return (
    <Card
      elevation={recommended || connect ? "raised" : "rest"}
      className={`relative flex flex-col p-6 h-full ${
        recommended
          ? "ring-2 ring-pine"
          : connect
            ? "ring-1 ring-pine/40 bg-pine-tint"
            : free
              ? "bg-surface-2/60"
              : ""
      }`}
    >
      {recommended && (
        <span className="absolute -top-3 left-6 text-[11px] font-semibold uppercase tracking-wide bg-accent-gradient text-on-accent px-2.5 py-1 rounded-pill shadow-accent">
          Most popular
        </span>
      )}
      {connect && (
        <span className="absolute -top-3 left-6 text-[11px] font-semibold uppercase tracking-wide bg-surface text-pine-deep border border-pine/30 px-2.5 py-1 rounded-pill shadow-rest">
          No subscription
        </span>
      )}
      <h3 className="font-display text-display-sm font-semibold">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted min-h-[40px]">{plan.blurb}</p>
      <p className="mt-5 font-display text-display font-semibold">
        {planPriceLabel(plan)}
        {plan.cadence === "per month" && (
          <span className="text-base text-muted font-normal font-sans tracking-normal"> /month</span>
        )}
      </p>
      {plan.cadence === "free" && <p className="text-xs text-muted mt-1">No card needed</p>}
      {connect && <p className="text-xs text-pine-deep font-medium mt-1">+ ~2% per order — cancel any time</p>}
      <ul className="mt-6 space-y-2.5 text-sm text-ink-soft flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <svg viewBox="0 0 20 20" className="w-4 h-4 mt-0.5 shrink-0 text-pine" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 10.5l3.5 3.5L16 6" />
            </svg>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-7">
        <LinkButton href="/signup" variant={recommended ? "primary" : "secondary"} full>
          {free ? "Start free" : `Choose ${plan.name}`}
        </LinkButton>
      </div>
    </Card>
  );
}

function Pricing() {
  return (
    <section id="pricing" className={`${CONTAINER} py-16 sm:py-20 scroll-mt-16`}>
      <Reveal>
        <h2 className="font-display text-display font-semibold">Simple pricing</h2>
        <p className="mt-3 text-ink-soft max-w-lg">
          Start free with a digital menu while you set up. Move to a flat monthly
          plan when you&apos;re ready for live ordering across the venue.
        </p>
      </Reveal>
      {/* Rendered straight from PLANS so this page can't drift from the
          catalogue the billing flow uses. 5 tiers now (Connect added) —
          wraps 3-then-2 from lg up, all 5 in one row only once there's
          genuinely room for it, rather than forcing a horizontal scroll. */}
      <RevealGroup className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4 pt-3">
        {PLANS.map((plan) => (
          <RevealItem key={plan.tier} className="h-full">
            <PricingCard plan={plan} />
          </RevealItem>
        ))}
      </RevealGroup>
      <p className="mt-6 text-sm text-muted max-w-2xl">
        Prices in AUD, excluding GST. Live payments are processed by a licensed
        payment provider; a short verification is required before you can
        accept real payments.
      </p>
    </section>
  );
}

function FAQ() {
  const qs = [
    [
      "Do customers need to download an app?",
      "No. They scan the QR code and everything opens in their phone's browser.",
    ],
    [
      "Can staff still take orders?",
      "Yes. Staff sign in on a shared tablet with a PIN and can take orders, mark items sold out, and work the kitchen board — useful when a customer's phone is flat.",
    ],
    [
      "How does bill splitting work?",
      "Customers can split equally between any number of people, pay only for their own items, or enter a custom amount. Nobody can overpay the bill.",
    ],
    [
      "What do I need to get started?",
      "An email address. Sign up, add your menu and tables, print your codes. There's a one-tap sample menu if you want to see it working first.",
    ],
  ];
  return (
    <section className="bg-surface border-y border-line">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
        <Reveal>
          <h2 className="font-display text-display font-semibold">Questions</h2>
        </Reveal>
        <RevealGroup className="mt-8 divide-y divide-line" each={0.06}>
          {qs.map(([q, a]) => (
            <RevealItem key={q} className="py-5">
              <h3 className="font-medium">{q}</h3>
              <p className="mt-2 text-ink-soft">{a}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className={`${CONTAINER} py-20 text-center`}>
      <Reveal>
        <h2 className="font-display text-display sm:text-display-lg font-semibold">
          Give your customers a faster way to pay.
        </h2>
        <p className="mt-4 text-ink-soft max-w-md mx-auto">
          Set up your venue in an afternoon and see it working on your own tables.
        </p>
        <div className="mt-8">
          <LinkButton href="/signup" size="lg">
            Set up your venue
          </LinkButton>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className={`${CONTAINER} py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted`}>
        <span className="font-display font-semibold text-ink">Tillz</span>
        <span>QR ordering, splitting and payments for Australian venues.</span>
        <span className="flex items-center gap-4">
          <Link href="/staff" className="hover:text-ink">
            Staff sign in
          </Link>
          <Link href="/login" className="hover:text-ink">
            Log in
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/support" className="hover:text-ink">
            Support
          </Link>
        </span>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <MarketingNav />
      <Hero />
      <How />
      <Benefits />
      <Positioning />
      <Pricing />
      <FAQ />
      <FinalCta />
      <Footer />
    </div>
  );
}
