import Link from "next/link";
import { ReplayTourButton } from "@/components/tour/replay-tour-button";

type Item = { q: string; a: React.ReactNode };
type Category = { title: string; items: Item[] };

// Static, hand-written how-to content covering the app's actual current
// feature set — not generated from the codebase, so it needs a human pass
// whenever a feature changes shape. Grouped by the same areas the sidebar
// nav uses, so "how do I..." maps to "where do I go" without translation.
const CATEGORIES: Category[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "How do I set up my venue?",
        a: "The onboarding wizard walks through venue details, tables, hours, menu, branding and tax details in order. Everything it asks is editable later in Settings — nothing is locked in.",
      },
      {
        q: "How do customers actually order?",
        a: "Each table gets its own QR code (Tables → the table → QR). A guest scans it, lands on your menu with no login, and — if ordering/payment are turned on — orders and pays from their phone.",
      },
      {
        q: "Where do I load a sample menu to try things out?",
        a: "Dashboard → Menu, if your menu is empty, has a \"load a sample café\" option that seeds a small realistic menu you can then edit or delete.",
      },
    ],
  },
  {
    title: "Menu",
    items: [
      {
        q: "How do I add or edit menu items?",
        a: "Dashboard → Menu. Add categories, then items inside them — name, description, price, photo, allergens, badges (Popular, New, etc.) and modifier groups (sizes, add-ons) all live on the item.",
      },
      {
        q: "How do I mark something sold out?",
        a: "Menu → the item → \"Mark sold out\". It disappears from customer ordering immediately, but stays in your menu list so you can bring it back with one tap. Staff can also 86 an item straight from the kitchen screen.",
      },
      {
        q: "Can I import a whole menu at once?",
        a: "Menu → \"Import from CSV\". Download the template first — it shows the exact columns (category, name, price, description, etc.) the importer expects.",
      },
      {
        q: "How does kitchen routing work?",
        a: "Settings define your prep stations (e.g. Barista, Grill, Oven) on the Menu page. Each category defaults to a station, and any individual item can override it — a coffee-flavoured dessert can still go to Barista even inside a \"Desserts\" category.",
      },
    ],
  },
  {
    title: "Tables & QR codes",
    items: [
      {
        q: "How do I add tables?",
        a: "Dashboard → Tables → Add table. Give it a label (matches what's printed on your table) and optionally a section (Indoor, Courtyard, etc.) for grouping on the floor view.",
      },
      {
        q: "A QR code stopped working / I need to reprint one",
        a: "Tables → the table → QR gives you a fresh downloadable code. Revoking the old one (if a card was lost or damaged) instantly invalidates it — a new scan of the old code fails safely instead of reaching an old session.",
      },
    ],
  },
  {
    title: "Orders & Kitchen",
    items: [
      {
        q: "Where do live orders show up?",
        a: "Staff → Kitchen (or Dashboard → Kitchen for a read-mostly owner view). Tickets appear the moment an order's placed, with a status flow of Submitted → Preparing → Ready → Served.",
      },
      {
        q: "How do stations work on the kitchen screen?",
        a: "If you've defined stations, tabs appear across the top of the kitchen board to filter to just one station's tickets. A staff PIN account can also be locked to a single station in Staff logins — it opens straight to that board with no way to see other stations.",
      },
      {
        q: "How does a waiter know an order is ready?",
        a: "The staff floor page buzzes/chimes the moment the kitchen marks an order Ready, with a \"Mark served\" button right there — no need to keep checking the kitchen screen.",
      },
      {
        q: "Can customers leave notes on an order?",
        a: "Yes — in the cart review step before placing an order, each line has an \"Add a note\" option (e.g. \"no fries\"), separate from a note for the whole order.",
      },
      {
        q: "What does \"awaiting approval\" mean?",
        a: "If Staff approval is turned on (Settings → Service model), customer orders sit in a queue until staff accept them, before the kitchen ever sees them — a safeguard against accidental or prank orders.",
      },
    ],
  },
  {
    title: "Staff & PIN logins",
    items: [
      {
        q: "What's the difference between Team and Staff logins?",
        a: "Team (Settings → Staff) is for email/password accounts — owners, admins, managers. Staff logins (Dashboard → Staff logins) is a PIN-based sign-in for floor/kitchen staff who don't need a full account, just a name and a short PIN.",
      },
      {
        q: "How do I add a floor staff member?",
        a: "Staff logins → Add an employee → pick a role. A PIN is generated once and shown to you — write it down, it can't be shown again, only reset.",
      },
      {
        q: "How do I lock a kitchen login to one station?",
        a: "Staff logins → find the KITCHEN-role account → the station dropdown next to their role. Set it to a specific station and that login always opens straight to that station's board and only ever sees its own tickets.",
      },
    ],
  },
  {
    title: "Payments & Bills",
    items: [
      {
        q: "How does bill splitting work?",
        a: "Customers can pay in full, split equally by however many people, pay for just their own items, or enter a custom amount — whichever methods you've enabled in Settings → Service model.",
      },
      {
        q: "What's the difference between \"pay after\" and \"pay before\"?",
        a: "After (default) is a running tab — order freely, pay when ready. Before prompts payment as soon as an order is placed. A stricter \"require payment before ordering\" mode goes further: the customer page treats an unpaid order as blocked rather than just suggesting payment.",
      },
      {
        q: "Where do I see all bills and payments?",
        a: "Dashboard → Bills for live/recent bills, or Invoices for a searchable, dated history with CSV export for your records.",
      },
      {
        q: "How do refunds work?",
        a: "From a bill's payment record (Bills or a table's current bill), a refund can be full or partial and always ties back to the original payment for reconciliation — never adjusted against the bill in aggregate.",
      },
    ],
  },
  {
    title: "Branding — \"make it yours\"",
    items: [
      {
        q: "Where do I change how my ordering page looks?",
        a: "Settings → Branding. Theme, accent colour, font, corner style, menu layout, and deeper per-detail styling (card style, buttons, section headers, background) all live here, with a live preview alongside.",
      },
      {
        q: "How do I upload a logo or background photo?",
        a: "Settings → Branding → Images. PNG and JPEG are both accepted; images are automatically compressed before upload so they stay fast to load.",
      },
      {
        q: "Can I customise the printed table QR cards?",
        a: "Yes — Settings → Branding → QR code & table cards covers the QR's own colours/corner style and which printable card template downloads use by default.",
      },
    ],
  },
  {
    title: "Analytics & reporting",
    items: [
      {
        q: "Where do I see how the venue's doing?",
        a: "Dashboard → Analytics covers revenue, top items, and customer visit tracking over a date range you pick. A weekly report view summarises the same data at a glance.",
      },
    ],
  },
  {
    title: "Settings & account",
    items: [
      {
        q: "How do I set my venue's country and tax details?",
        a: "Settings → Venue. Country/timezone/currency and any country-specific tax fields (e.g. ABN for Australia) live together — tax fields shown depend on the country you've selected.",
      },
      {
        q: "How do I export my data, or close my account?",
        a: "Settings → Privacy & data. Export gives you a JSON download of your venues, floor plan, menu and staff list. Account deletion is a recorded request, not an instant purge — paid bills are tax records that must be kept for 5 years regardless.",
      },
      {
        q: "What's the difference between deactivating and deleting?",
        a: "Deactivating (also under Privacy & data) immediately signs your whole team out — dashboard and every staff PIN — and cancels your subscription, but is reversible: you get an emailed link to reactivate. Deletion is a longer-term closure request.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Help
        </h1>
        <p className="text-muted mt-1">
          How to use every part of Tillz. Can&apos;t find what you need?{" "}
          <Link href="/support" className="text-pine hover:underline">
            Contact support
          </Link>
          .
        </p>
        <div className="mt-3">
          <ReplayTourButton />
        </div>
      </div>

      {CATEGORIES.map((cat) => (
        <section key={cat.title}>
          <h2 className="font-display text-lg font-semibold tracking-tight mb-3">
            {cat.title}
          </h2>
          <div className="space-y-2">
            {cat.items.map((item) => (
              <details
                key={item.q}
                className="group rounded-[var(--radius-card)] border border-line bg-surface p-4 open:pb-4"
              >
                <summary className="text-sm font-medium cursor-pointer list-none flex items-center justify-between gap-3">
                  {item.q}
                  <span className="text-muted shrink-0 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-sm text-muted mt-2 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
