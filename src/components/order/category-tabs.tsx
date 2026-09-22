"use client";

// Shared "All" + per-category filter row — used by both the customer's
// interactive ordering menu (MenuOrderer) and the read-only menu views
// (MenuDisplay, and /m/[slug] via MenuDisplay). Client-side filter only: the
// parent owns which category is active and just re-renders what it shows:
// this component has no state of its own, only the tab row itself.
export function CategoryTabs({
  categories,
  activeCategoryId,
  onChange,
}: {
  categories: { id: string; name: string }[];
  activeCategoryId: string | null;
  onChange: (categoryId: string | null) => void;
}) {
  // Nothing to filter with only one category (or none).
  if (categories.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
          activeCategoryId === null
            ? "border-pine bg-pine-soft text-pine-deep"
            : "border-line text-muted hover:border-ink/30"
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onChange(cat.id)}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
            activeCategoryId === cat.id
              ? "border-pine bg-pine-soft text-pine-deep"
              : "border-line text-muted hover:border-ink/30"
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
