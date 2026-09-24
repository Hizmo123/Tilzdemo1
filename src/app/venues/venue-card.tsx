import { setActiveVenue } from "./actions";

// A plain server-rendered form, not a client component — setActiveVenue
// itself redirects on success, so there's no client-side state to manage
// (no pending spinner needed for a click that immediately navigates away).
export function VenueCard({
  id,
  name,
  published,
}: {
  id: string;
  name: string;
  published: boolean;
}) {
  return (
    <form action={setActiveVenue.bind(null, id)}>
      <button
        type="submit"
        className="w-full text-left rounded-[var(--radius-card)] border border-line bg-surface p-5 hover:border-pine/40 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-lg font-semibold tracking-tight">
            {name}
          </span>
          <span
            className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--radius-xs)] shrink-0 ${
              published ? "bg-pine-soft text-pine-deep" : "bg-paper text-muted"
            }`}
          >
            {published ? "Live" : "Not live"}
          </span>
        </div>
      </button>
    </form>
  );
}
