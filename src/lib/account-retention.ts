// How long financial records survive an account deletion. Paid bills are tax
// invoices, and Australian tax law requires keeping them for 5 years — see the
// Organization.deletionExecutedAt schema comment. A plain module (no Prisma,
// no server-only imports) so the client-side deletion UI quotes the SAME
// number the server actually enforces, instead of a second hardcoded "5".
export const ACCOUNT_RETENTION_YEARS = 5;

// Calendar years, not 365 * 5 days — leap days would otherwise make the
// "eligible from" date drift earlier than a true 5 years. Feb 29 + 5 years
// lands on Mar 1 (JS's own overflow), which errs on the side of retaining
// slightly longer, never shorter.
export function purgeEligibleFrom(executedAt: Date): Date {
  const d = new Date(executedAt.getTime());
  d.setFullYear(d.getFullYear() + ACCOUNT_RETENTION_YEARS);
  return d;
}
