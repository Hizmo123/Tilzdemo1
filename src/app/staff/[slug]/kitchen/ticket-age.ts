// Ticket-age escalation, in one place for the board AND the pass view:
// fresh = info, approaching AGE_WARN = warn, past AGE_OVERDUE = danger.
// Same tokens the staff Floor uses, so a colour means the same thing on
// every staff screen. Venue-configurable thresholds would be a settings
// change (data), out of scope for the polish pass — change them here.
//
// Deliberately NO "use client" directive. pass-view.tsx is a Server
// Component and calls ageAccentClass() during render; when this lived in
// kitchen-ticket.tsx (a "use client" module) that call resolved to a client
// reference and threw "Attempted to call … from the server but it is on the
// client" the moment someone opened Pass. `next build` can't see that — it
// only fails at render time — so keep every value/function both sides need
// in a directive-free module like this one and import it from there.
export const AGE_WARN_MINUTES = 5;
export const AGE_OVERDUE_MINUTES = 10;

export function ageAccentClass(minutesAgo: number, active = true): string {
  if (!active) return "border-l-line-strong";
  if (minutesAgo >= AGE_OVERDUE_MINUTES) return "border-l-danger";
  if (minutesAgo >= AGE_WARN_MINUTES) return "border-l-warn";
  return "border-l-info";
}
