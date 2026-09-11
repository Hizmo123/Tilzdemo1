import { formatCents } from "@/lib/money";
import { gstBreakdown, formatAbn, type ReceiptData } from "@/lib/receipts";

// A printable Australian tax invoice. Pure presentation — no hooks — so it can
// render inside server components (customer and owner receipt pages). GST is
// shown as the inclusive component (total / 11).
export function TaxInvoice({ data }: { data: ReceiptData }) {
  const { gstCents, exGstCents } = gstBreakdown(data.totalCents);
  const remaining = Math.max(0, data.totalCents - data.amountPaidCents);
  const fullyPaid = remaining <= 0;
  const issued = new Date(data.issuedAt);

  return (
    <div className="mx-auto max-w-md bg-white text-[#15181b] rounded-2xl border border-[#e6e3dc] p-7 print:border-0 print:rounded-none print:max-w-none">
      <div className="text-center border-b border-dashed border-[#d8d4ca] pb-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[#6b7169]">
          Tax Invoice
        </p>
        <h1 className="text-xl font-semibold mt-1">{data.restaurantName}</h1>
        {data.abn && (
          <p className="text-xs text-[#6b7169] mt-0.5">
            ABN {formatAbn(data.abn)}
          </p>
        )}
        {data.addressLines.map((l, i) => (
          <p key={i} className="text-xs text-[#6b7169]">
            {l}
          </p>
        ))}
      </div>

      <div className="flex justify-between text-xs text-[#3a4147] mt-4">
        <span>Table {data.tableLabel}</span>
        <span>
          {issued.toLocaleString("en-AU", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      </div>

      <table className="w-full text-sm mt-4">
        <tbody>
          {data.items.map((it, i) => (
            <tr key={i} className="align-top">
              <td className="py-1 pr-2">
                <span className="tabular-nums">{it.quantity}× </span>
                {it.name}
                {it.modifiers.length > 0 && (
                  <span className="block text-xs text-[#6b7169]">
                    {it.modifiers.join(", ")}
                  </span>
                )}
              </td>
              <td className="py-1 text-right tabular-nums whitespace-nowrap">
                {formatCents(it.lineTotalCents, data.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-[#e6e3dc] mt-3 pt-3 text-sm space-y-1">
        <Row
          label="Subtotal (ex GST)"
          value={formatCents(exGstCents, data.currency)}
          muted
        />
        <Row
          label="GST (10%)"
          value={formatCents(gstCents, data.currency)}
          muted
        />
        <Row
          label="Total (inc GST)"
          value={formatCents(data.totalCents, data.currency)}
          bold
        />
        {data.tipCents > 0 && (
          <Row
            label="Tip"
            value={formatCents(data.tipCents, data.currency)}
            muted
          />
        )}
      </div>

      {data.payments.length > 0 && (
        <div className="border-t border-[#e6e3dc] mt-3 pt-3 text-xs text-[#3a4147] space-y-1">
          {data.payments.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span className="capitalize">
                {p.provider === "counter" ? "Paid at counter" : `Paid (${p.provider})`}
              </span>
              <span className="tabular-nums">
                {formatCents(p.amountCents + p.tipCents, data.currency)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-[#e6e3dc] mt-3 pt-3 text-sm">
        {fullyPaid ? (
          <Row
            label="Paid in full"
            value={formatCents(data.amountPaidCents, data.currency)}
            bold
          />
        ) : (
          <>
            <Row
              label="Paid"
              value={formatCents(data.amountPaidCents, data.currency)}
              muted
            />
            <Row
              label="Balance due"
              value={formatCents(remaining, data.currency)}
              bold
            />
          </>
        )}
      </div>

      {data.anyTest && (
        <p className="mt-5 text-center text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 rounded-md py-2 print:bg-transparent">
          Test payment — no real money moved
        </p>
      )}

      <p className="text-center text-[11px] text-[#6b7169] mt-5">
        Thank you
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${bold ? "font-semibold" : ""} ${
        muted ? "text-[#6b7169]" : ""
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
