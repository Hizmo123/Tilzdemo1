// The literal an admin must type to purge a deleted organisation's retained
// records. A plain module (no server-only imports, no "use server") so the
// client-side purge panel and the server action share ONE definition — a
// "use server" file can only export async functions, so it can't live there.
export const PURGE_CONFIRMATION = "DELETE";
