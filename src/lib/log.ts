// Structured logging for the paths that matter operationally: order creation,
// payments, refunds. Plain JSON lines to stdout/stderr — Vercel captures and
// makes these searchable without any extra setup, and this is the same shape
// a real log drain (or Sentry breadcrumbs, once configured) would want. Never
// log a full phone number, email, or anything card-related — these are
// operational traces, not the audit trail (see lib/audit.ts for the
// user-facing "who did what" record, which is a separate, persisted concern).
type LogFields = Record<string, string | number | boolean | null | undefined>;

function emit(level: "info" | "warn" | "error", event: string, fields?: LogFields) {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};
