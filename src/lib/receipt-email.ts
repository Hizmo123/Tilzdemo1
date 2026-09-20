import { formatCents } from "@/lib/money";
import { gstBreakdown, formatAbn, type ReceiptData } from "@/lib/receipts";

// Renders a ReceiptData into an email. Email clients don't run Tailwind, so
// this is hand-rolled inline-styled HTML rather than reusing <TaxInvoice/> —
// same data, same shape as the on-screen/printed tax invoice, just a
// table-based layout that survives Outlook/Gmail's CSS stripping.
export function buildReceiptEmail(data: ReceiptData): {
  subject: string;
  html: string;
  text: string;
} {
  // A card surcharge is additional consideration for the supply, so it's
  // folded into the taxable total for GST purposes.
  const grandTotalCents = data.totalCents + data.surchargeCents;
  const { gstCents, exGstCents } = gstBreakdown(grandTotalCents);
  const issued = new Date(data.issuedAt);
  const issuedLabel = issued.toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const money = (c: number) => formatCents(c, data.currency);

  const subject = `Your receipt from ${data.restaurantName}`;

  const itemRows = data.items
    .map(
      (it) => `
      <tr>
        <td style="padding:4px 0;font-size:14px;color:#15181b;">
          ${it.quantity}× ${escapeHtml(it.name)}
          ${it.modifiers.length ? `<div style="font-size:12px;color:#6b7169;">${escapeHtml(it.modifiers.join(", "))}</div>` : ""}
        </td>
        <td style="padding:4px 0;font-size:14px;color:#15181b;text-align:right;white-space:nowrap;">${money(it.lineTotalCents)}</td>
      </tr>`,
    )
    .join("");

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f5f1;padding:24px;">
    <div style="max-width:420px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e6e3dc;padding:28px;">
      <div style="text-align:center;border-bottom:1px dashed #d8d4ca;padding-bottom:16px;">
        <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6b7169;margin:0;">Tax Invoice</p>
        <h1 style="font-size:20px;margin:4px 0 0;color:#15181b;">${escapeHtml(data.restaurantName)}</h1>
        ${data.abn ? `<p style="font-size:12px;color:#6b7169;margin:2px 0 0;">ABN ${formatAbn(data.abn)}</p>` : ""}
        ${data.addressLines.map((l) => `<p style="font-size:12px;color:#6b7169;margin:2px 0 0;">${escapeHtml(l)}</p>`).join("")}
      </div>

      <table style="width:100%;font-size:12px;color:#3a4147;margin-top:16px;">
        <tr>
          <td>${data.tableLabel ? `Table ${escapeHtml(data.tableLabel)}` : "Counter"}</td>
          <td style="text-align:right;">${issuedLabel}</td>
        </tr>
      </table>

      <table style="width:100%;margin-top:16px;border-collapse:collapse;">
        ${itemRows}
      </table>

      <table style="width:100%;margin-top:12px;border-top:1px solid #e6e3dc;padding-top:12px;font-size:14px;color:#6b7169;">
        <tr><td>Subtotal (ex GST)</td><td style="text-align:right;">${money(exGstCents)}</td></tr>
        <tr><td>GST (10%)</td><td style="text-align:right;">${money(gstCents)}</td></tr>
        ${data.surchargeCents > 0 ? `<tr><td>Card surcharge (inc. GST)</td><td style="text-align:right;">${money(data.surchargeCents)}</td></tr>` : ""}
        <tr style="color:#15181b;font-weight:600;"><td>Total (inc GST)</td><td style="text-align:right;">${money(grandTotalCents)}</td></tr>
        ${data.tipCents > 0 ? `<tr><td>Tip</td><td style="text-align:right;">${money(data.tipCents)}</td></tr>` : ""}
        ${data.refundedCents > 0 ? `<tr><td>Refunded</td><td style="text-align:right;">−${money(data.refundedCents)}</td></tr>` : ""}
      </table>

      ${
        data.anyTest
          ? `<p style="text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#92400e;background:#fffbeb;border-radius:6px;padding:8px;margin-top:16px;">Test payment — no real money moved</p>`
          : ""
      }

      <p style="text-align:center;font-size:11px;color:#6b7169;margin-top:20px;">Thank you</p>
    </div>
  </div>`;

  const text = [
    `Tax Invoice — ${data.restaurantName}`,
    data.abn ? `ABN ${formatAbn(data.abn)}` : null,
    ...data.addressLines,
    "",
    `${data.tableLabel ? `Table ${data.tableLabel}` : "Counter"} · ${issuedLabel}`,
    "",
    ...data.items.map(
      (it) =>
        `${it.quantity}x ${it.name}${it.modifiers.length ? ` (${it.modifiers.join(", ")})` : ""} — ${money(it.lineTotalCents)}`,
    ),
    "",
    `Subtotal (ex GST): ${money(exGstCents)}`,
    `GST (10%): ${money(gstCents)}`,
    data.surchargeCents > 0 ? `Card surcharge (inc. GST): ${money(data.surchargeCents)}` : null,
    `Total (inc GST): ${money(grandTotalCents)}`,
    data.tipCents > 0 ? `Tip: ${money(data.tipCents)}` : null,
    data.refundedCents > 0 ? `Refunded: -${money(data.refundedCents)}` : null,
    "",
    "Thank you",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
