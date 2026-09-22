import Link from "next/link";
import { AuthPanelArt } from "./panel-art";

// Split layout: a brand panel on the left (desktop), the form on the right.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-ink text-surface p-12 relative overflow-hidden">
        <Link href="/" className="relative font-display text-2xl font-semibold tracking-tight">
          Tillz
        </Link>

        <div className="relative grid gap-12 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <h2 className="font-display text-display font-semibold">
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
                  <span className="w-1.5 h-1.5 rounded-pill inline-block bg-success" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="w-[300px] xl:w-[320px] justify-self-start xl:justify-self-end">
            <AuthPanelArt />
          </div>
        </div>

        <p className="relative text-white/40 text-xs">For Australian venues</p>
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
