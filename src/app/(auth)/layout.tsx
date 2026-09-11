import Link from "next/link";

// Split layout: a brand panel on the left (desktop), the form on the right.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-ink text-surface p-12">
        <Link href="/" className="font-display text-2xl font-semibold tracking-tight">
          Tillz
        </Link>
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight leading-tight">
            Order, split and pay
            <br />
            from the table.
          </h2>
          <ul className="mt-8 space-y-3 text-white/70 text-sm">
            {[
              "QR & tap ordering — no app to download",
              "Split the bill any way, pay from the phone",
              "Live orders, kitchen board and analytics",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: "#2FB37A" }} />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-white/40 text-xs">
          For Australian venues · Development build
        </p>
      </div>

      {/* Form side */}
      <main className="flex flex-col items-center justify-center px-6 py-10">
        <Link
          href="/"
          className="lg:hidden font-display text-2xl font-semibold tracking-tight mb-8"
        >
          Tillz
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
