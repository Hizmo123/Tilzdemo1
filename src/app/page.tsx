import Link from "next/link";

// Public marketing site. Honest scope: it only names what the product actually
// does today (order, split, pay, staff terminal, kitchen) — no POS/loyalty
// claims that aren't built, and no fabricated uplift statistics.

function Nav() {
  return (
    <header className="border-b border-line">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <span className="font-display text-xl font-semibold tracking-tight">
          Tillz
        </span>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/staff"
            className="text-sm text-ink-soft hover:text-ink px-3 py-2"
          >
            Staff sign in
          </Link>
          <Link
            href="/login"
            className="text-sm text-ink-soft hover:text-ink px-3 py-2"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium rounded-lg bg-ink text-surface px-4 py-2 hover:opacity-90"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

// The split-check hero visual: an itemized bill that resolves into three shares.
function SplitCheck() {
  const items = [
    ["Flat white", "5.00"],
    ["Smashed avo", "18.00"],
    ["Bacon & egg roll", "12.00"],
    ["Cold brew", "6.00"],
    ["Banana bread", "6.00"],
  ];
  return (
    <div className="relative">
      <div className="rounded-2xl border border-line bg-surface shadow-sm p-6 max-w-sm mx-auto lg:mx-0">
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <span className="font-display text-lg font-semibold tracking-tight">
            Harbour Kitchen
          </span>
          <span className="text-sm text-muted">Table 7</span>
        </div>
        <ul className="py-3 space-y-1.5">
          {items.map(([name, price]) => (
            <li key={name} className="flex justify-between text-sm">
              <span>{name}</span>
              <span className="tabular-nums text-muted">${price}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-line pt-3 font-medium">
          <span>Total</span>
          <span className="tabular-nums">$47.00</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {["Ari", "Sam", "Jo"].map((who) => (
            <div
              key={who}
              className="rounded-xl bg-pine-soft text-pine-deep text-center py-2.5"
            >
              <div className="text-xs">{who}</div>
              <div className="font-semibold tabular-nums">$15.67</div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-ink text-surface text-center py-2.5 text-sm font-medium">
          Paid from the table
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
          Let your table order, split and pay by themselves.
        </h1>
        <p className="mt-5 text-lg text-ink-soft max-w-md">
          Your customers scan a QR code, order from your menu, split the bill any
          way they like, and pay from their phone. No app to download, no waiting
          for the check.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="rounded-xl bg-pine text-white px-6 py-3 font-medium hover:bg-pine-deep"
          >
            Set up your venue
          </Link>
          <a
            href="#how"
            className="rounded-xl border border-line px-6 py-3 font-medium hover:border-ink/30"
          >
            See how it works
          </a>
        </div>
        <p className="mt-4 text-sm text-muted">
          Free to start. Set it up yourself in an afternoon — no sales call.
        </p>
      </div>
      <SplitCheck />
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
    <section id="how" className="bg-surface border-y border-line">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          How it works
        </h2>
        <div className="mt-10 grid md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.n}>
              <div className="w-9 h-9 rounded-full bg-pine text-white flex items-center justify-center font-medium">
                {s.n}
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">
                {s.title}
              </h3>
              <p className="mt-2 text-ink-soft">{s.body}</p>
            </div>
          ))}
        </div>
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
    <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
      <h2 className="font-display text-3xl font-semibold tracking-tight">
        What it does for your venue
      </h2>
      <div className="mt-10 grid sm:grid-cols-2 gap-x-10 gap-y-8">
        {points.map((p) => (
          <div key={p.title} className="border-t border-line pt-5">
            <h3 className="font-display text-lg font-semibold tracking-tight">
              {p.title}
            </h3>
            <p className="mt-2 text-ink-soft max-w-md">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Positioning() {
  return (
    <section className="bg-ink text-surface">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          Built for the venue that just wants it to work
        </h2>
        <p className="mt-4 text-lg text-white/70 max-w-2xl">
          No demo to book, no quote that changes with your volume, no long
          contract. One clear price, sign up on the website, and you own your
          setup from day one.
        </p>
        <div className="mt-10 grid sm:grid-cols-3 gap-8">
          {[
            ["Sign up online", "Create your venue, add your menu and tables, print your codes. No onboarding rep required."],
            ["One flat price", "You know what you pay before you start. No per-order surprises, no volume tiers to decode."],
            ["Yours to leave", "Your menu, your data. Month to month — stay because it works, not because you're locked in."],
          ].map(([t, b]) => (
            <div key={t}>
              <h3 className="font-display text-lg font-semibold tracking-tight">
                {t}
              </h3>
              <p className="mt-2 text-white/70">{b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
      <h2 className="font-display text-3xl font-semibold tracking-tight">
        Simple pricing
      </h2>
      <p className="mt-3 text-ink-soft max-w-lg">
        Start free while you set up and try it on a few tables. Move to a flat
        monthly plan when you go live across the venue.
      </p>
      <div className="mt-10 grid md:grid-cols-2 gap-4 max-w-3xl">
        <div className="rounded-2xl border border-line bg-surface p-7">
          <h3 className="font-display text-xl font-semibold tracking-tight">
            Starter
          </h3>
          <p className="mt-1 text-muted">To set up and try it out</p>
          <p className="mt-5 font-display text-4xl font-semibold tracking-tight">
            Free
          </p>
          <ul className="mt-6 space-y-2 text-sm text-ink-soft">
            <li>Full menu, tables and QR codes</li>
            <li>Ordering, bill splitting and test payments</li>
            <li>Staff logins and kitchen screen</li>
          </ul>
          <Link
            href="/signup"
            className="mt-7 block text-center rounded-xl border border-line py-3 font-medium hover:border-ink/30"
          >
            Get started
          </Link>
        </div>
        <div className="rounded-2xl border-2 border-pine bg-surface p-7">
          <h3 className="font-display text-xl font-semibold tracking-tight">
            Venue
          </h3>
          <p className="mt-1 text-muted">For live service</p>
          <p className="mt-5 font-display text-4xl font-semibold tracking-tight">
            $49<span className="text-lg text-muted font-normal">/month</span>
          </p>
          <ul className="mt-6 space-y-2 text-sm text-ink-soft">
            <li>Everything in Starter</li>
            <li>Live payments to your account</li>
            <li>All your tables, one flat price</li>
          </ul>
          <Link
            href="/signup"
            className="mt-7 block text-center rounded-xl bg-pine text-white py-3 font-medium hover:bg-pine-deep"
          >
            Set up your venue
          </Link>
        </div>
      </div>
      <p className="mt-5 text-sm text-muted">
        Live payments are processed by a licensed payment provider; a short
        verification is required before you can accept real payments.
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
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          Questions
        </h2>
        <div className="mt-8 divide-y divide-line">
          {qs.map(([q, a]) => (
            <div key={q} className="py-5">
              <h3 className="font-medium">{q}</h3>
              <p className="mt-2 text-ink-soft">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="max-w-6xl mx-auto px-5 sm:px-8 py-20 text-center">
      <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
        Give your customers a faster way to pay.
      </h2>
      <p className="mt-4 text-ink-soft max-w-md mx-auto">
        Set up your venue in an afternoon and see it working on your own tables.
      </p>
      <Link
        href="/signup"
        className="mt-8 inline-block rounded-xl bg-pine text-white px-7 py-3.5 font-medium hover:bg-pine-deep"
      >
        Set up your venue
      </Link>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted">
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
      <Nav />
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
