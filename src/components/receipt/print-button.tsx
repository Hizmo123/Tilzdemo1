"use client";

// Triggers the browser's print dialog. Hidden when printing (print:hidden) so it
// never appears on the printed receipt. Because the receipt pages have no app
// chrome, the printout is just the invoice.
export function PrintButton({ label = "Print / Save PDF" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden rounded-[var(--radius-md)] bg-[#15181b] text-white px-5 py-2.5 text-sm font-medium hover:opacity-90"
    >
      {label}
    </button>
  );
}
