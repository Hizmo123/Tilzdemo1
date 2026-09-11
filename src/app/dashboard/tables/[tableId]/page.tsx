import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, getOwnedTable } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { qrDataUrl, visitUrl } from "@/lib/qr";
import { QrActions } from "./qr-actions";
import { NfcSection } from "./nfc-section";

export default async function TableDetailPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = await params;
  const user = await requireUser();
  const table = await getOwnedTable(user.id, tableId);
  if (!table) notFound();

  const activeToken = await prisma.qrToken.findFirst({
    where: { tableId: table.id, active: true },
    orderBy: { createdAt: "desc" },
  });

  const preview = activeToken ? await qrDataUrl(activeToken.token) : null;
  const url = activeToken ? visitUrl(activeToken.token) : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/dashboard/tables"
          className="text-sm text-muted hover:text-ink"
        >
          ← All tables
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Table {table.label}
          </h1>
          <span
            className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded ${
              table.active
                ? "bg-pine-soft text-pine-deep"
                : "bg-paper text-muted"
            }`}
          >
            {table.active ? "Active" : "Off"}
          </span>
        </div>
        <p className="text-muted mt-1">
          {table.location.restaurant.name} · {table.location.name}
          {table.section ? ` · ${table.section}` : ""}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 flex flex-col items-center">
          {preview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={preview}
              alt={`QR code for table ${table.label}`}
              className="w-56 h-56"
              width={224}
              height={224}
            />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-sm text-muted text-center">
              No active QR. Regenerate to create one.
            </div>
          )}
          {url && (
            <p className="text-xs text-muted mt-4 break-all text-center">
              {url}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
            <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
              Print
            </h2>
            <p className="text-sm text-muted mb-4">
              A framed card (SVG) for a table stand, or a high-res PNG.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/dashboard/tables/${table.id}/qr?format=svg`}
                className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-ink/30 transition-colors"
              >
                Download card (SVG)
              </a>
              <a
                href={`/dashboard/tables/${table.id}/qr?format=png`}
                className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-ink/30 transition-colors"
              >
                Download PNG
              </a>
            </div>
          </div>

          <QrActions tableId={table.id} active={table.active} />

          {url && <NfcSection url={url} />}
        </div>
      </div>
    </div>
  );
}
