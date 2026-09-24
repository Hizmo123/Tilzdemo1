"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { formatCents } from "@/lib/money";
import { BADGE_META, type BadgeKey } from "@/lib/menu-badges";
import { toggleItemAvailable, deleteItem } from "./actions";
import { ItemPanel, Switch } from "./item-panel";
import { LoadSampleButton } from "../sample/load-sample-button";
import type { MenuCategoryRow, MenuItemRow } from "./menu-types";

type Row = MenuItemRow & {
  categoryId: string;
  categoryName: string;
  categoryStation: string | null;
};

// `session` bumps on every open so the panel remounts with fresh state (a
// closed-then-reopened "Add item" mustn't carry the previous draft), while
// staying mounted through close so the Sheet's exit animation can play.
type PanelState = {
  open: boolean;
  item: MenuItemRow | null;
  defaultCategoryId: string | null;
  session: number;
};

// The flat products table: every item across every category, filterable by
// category and searchable by name. Add/Edit open the same slide-over.
export function ItemsView({
  categories,
  currency,
  stations,
}: {
  categories: MenuCategoryRow[];
  currency: string;
  stations: string[];
}) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState>({
    open: false,
    item: null,
    defaultCategoryId: null,
    session: 0,
  });

  const rows = useMemo<Row[]>(
    () =>
      categories.flatMap((c) =>
        c.items.map((i) => ({
          ...i,
          categoryId: c.id,
          categoryName: c.name,
          categoryStation: c.station,
        })),
      ),
    [categories],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) => (!categoryFilter || r.categoryId === categoryFilter) && (!q || r.name.toLowerCase().includes(q)),
    );
  }, [rows, categoryFilter, query]);

  const noCategories = categories.length === 0;

  function openAdd() {
    setPanel((p) => ({ open: true, item: null, defaultCategoryId: categoryFilter, session: p.session + 1 }));
  }
  function openEdit(item: MenuItemRow) {
    setPanel((p) => ({ open: true, item, defaultCategoryId: null, session: p.session + 1 }));
  }
  function closePanel() {
    setPanel((p) => ({ ...p, open: false }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <svg
            viewBox="0 0 20 20"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13.5 13.5L17 17" />
          </svg>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items"
            aria-label="Search items"
            className="pl-10"
          />
        </div>
        <div data-tour="menu-add-item" className="shrink-0">
          <Button type="button" onClick={openAdd} disabled={noCategories} full>
            Add item
          </Button>
        </div>
      </div>

      {!noCategories && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
          <Chip tone="ink" selected={categoryFilter === null} onClick={() => setCategoryFilter(null)}>
            All
            <span className="ml-1.5 opacity-70 tabular-nums">{rows.length}</span>
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.id}
              tone="ink"
              selected={categoryFilter === c.id}
              onClick={() => setCategoryFilter(categoryFilter === c.id ? null : c.id)}
            >
              {c.name}
              <span className="ml-1.5 opacity-70 tabular-nums">{c.items.length}</span>
            </Chip>
          ))}
        </div>
      )}

      {noCategories ? (
        <Card className="border-dashed text-center p-8">
          <p className="text-muted mb-4">
            Items live inside categories (e.g. Burgers, Drinks). Add your first category on
            the{" "}
            <Link href="/dashboard/menu?view=categories" className="text-pine hover:underline">
              Categories
            </Link>{" "}
            tab — or load a sample menu to start from.
          </p>
          <div className="flex justify-center">
            <LoadSampleButton variant="inline" />
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-dashed text-center p-8">
          <p className="text-muted mb-4">No items yet. Add your first one.</p>
          <div className="flex justify-center">
            <Button type="button" onClick={openAdd}>
              Add item
            </Button>
          </div>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="border-dashed text-center p-8">
          <p className="text-muted">No items match{query.trim() ? ` “${query.trim()}”` : " this filter"}.</p>
        </Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line">
                  <th className="px-4 py-3 font-medium w-14">
                    <span className="sr-only">Image</span>
                  </th>
                  <th className="px-3 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Category</th>
                  <th className="px-3 py-3 font-medium text-right">Price</th>
                  <th className="px-3 py-3 font-medium">Station</th>
                  <th className="px-3 py-3 font-medium">Available</th>
                  <th className="px-4 py-3 font-medium text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((row) => (
                  <ItemTableRow key={row.id} row={row} currency={currency} onEdit={() => openEdit(row)} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-line text-xs text-muted">
            {visible.length} of {rows.length} item{rows.length === 1 ? "" : "s"}
          </div>
        </Card>
      )}

      <ItemPanel
        key={`${panel.item?.id ?? "new"}-${panel.session}`}
        open={panel.open}
        onClose={closePanel}
        item={panel.item}
        categories={categories}
        defaultCategoryId={panel.defaultCategoryId}
        stations={stations}
        currency={currency}
      />
    </div>
  );
}

function ItemTableRow({ row, currency, onEdit }: { row: Row; currency: string; onEdit: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const effectiveStation = row.station ?? row.categoryStation;
  const knownBadges = row.badges.filter((b): b is BadgeKey => b in BADGE_META);

  function toggle(next: boolean) {
    start(async () => {
      const res = await toggleItemAvailable(row.id, next);
      if ("error" in res && res.error) toast.show(res.error, "error");
      router.refresh();
    });
  }

  function remove() {
    start(async () => {
      const res = await deleteItem(row.id);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        setConfirming(false);
        return;
      }
      toast.show(`Deleted ${row.name}`);
      router.refresh();
    });
  }

  return (
    <tr className={`transition-colors hover:bg-surface-2/50 ${row.available ? "" : "text-muted"}`}>
      <td className="pl-4 pr-1 py-2.5">
        <div className="w-10 h-10 rounded-[var(--radius-sm)] overflow-hidden bg-paper border border-line flex items-center justify-center">
          {row.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={row.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg viewBox="0 0 20 20" className="w-4 h-4 text-line-strong" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <rect x="3" y="4" width="14" height="12" rx="2" />
              <path d="M3 13l4-4 3 3 2-2 5 5" />
            </svg>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 min-w-[220px]">
        <button type="button" onClick={onEdit} className="text-left group">
          <span className={`font-medium group-hover:text-pine ${row.available ? "text-ink" : "line-through"}`}>
            {row.name}
          </span>
          {row.description && <p className="text-xs text-muted truncate max-w-[320px]">{row.description}</p>}
        </button>
        {knownBadges.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {knownBadges.map((b) => (
              <span key={b} className={`text-[10px] font-medium rounded-pill px-2 py-0.5 leading-4 ${BADGE_META[b].className}`}>
                {BADGE_META[b].label}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">{row.categoryName}</td>
      <td className="px-3 py-2.5 text-right tabular-nums font-medium whitespace-nowrap">
        {formatCents(row.priceCents, currency)}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-pill ${effectiveStation ? "bg-pine" : "bg-line-strong"}`}
            aria-hidden
          />
          <span>{effectiveStation ?? "Default board"}</span>
          {!row.station && <span className="text-xs text-muted">via category</span>}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <Switch checked={row.available} onChange={toggle} disabled={pending} label={`${row.name} available`} />
      </td>
      <td className="pl-3 pr-4 py-2.5 text-right whitespace-nowrap">
        {confirming ? (
          <span className="inline-flex items-center gap-2">
            <span className="text-xs text-muted">Delete?</span>
            <Button type="button" variant="danger" size="sm" onClick={remove} loading={pending}>
              Delete
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </Button>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(true)}
              className="h-9 px-3 rounded-[var(--radius-sm)] text-sm text-muted hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-50"
            >
              Delete
            </button>
          </span>
        )}
      </td>
    </tr>
  );
}
