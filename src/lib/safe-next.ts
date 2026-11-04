// Same-origin relative path only: starts with "/" but not "//" or "/\", so a
// `next` param can never bounce a user to another site.
export function safeNextPath(raw: string | string[] | null | undefined, fallback = "/dashboard"): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
