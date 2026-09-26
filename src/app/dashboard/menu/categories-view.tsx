"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls, useReducedMotion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import {
  createCategory,
  updateCategoryOptions,
  updateKitchenStations,
  deleteCategoryAction,
  renameCategoryAction,
  reorderCategoriesAction,
  type MenuActionState,
} from "./actions";
import { DangerZone } from "./danger-zone";
import { LoadSampleButton } from "../sample/load-sample-button";
import type { MenuCategoryRow } from "./menu-types";

const initial: MenuActionState = {};

const SELECT_CLASS =
  "w-full h-9 rounded-[var(--radius-sm)] bg-surface px-2.5 text-sm text-ink border border-line hover:border-line-strong focus:outline-none focus:border-pine focus:ring-[3px] focus:ring-pine/20 disabled:opacity-50";
const TIME_CLASS = SELECT_CLASS;

// The structure side of the menu: the category list (rename / reorder /
// station default / hours / delete), plus the venue's kitchen stations and
// the whole-menu danger zone.
export function CategoriesView({
  categories,
  restaurantName,
  kitchenStations,
}: {
  categories: MenuCategoryRow[];
  restaurantName: string;
  kitchenStations: string[];
}) {
  const router = useRouter();
  const [reordering, setReordering] = useState(false);

  // Local order the drag list edits directly; the server-ordered
  // `categories` prop is the source of truth again after every persist +
  // router.refresh(). While a save is scheduled/in flight the prop is NOT
  // re-synced, so a refresh landing mid-drag can't snap the list back.
  const [order, setOrder] = useState(categories);
  const orderRef = useRef(order);
  orderRef.current = order;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef(false);
  useEffect(() => {
    if (!pendingSave.current) setOrder(categories);
  }, [categories]);

  // Persist the current order, debounced 400ms after the LAST drag end /
  // move — not on every intermediate reorder frame — through the same
  // action the old up/down buttons used (it takes any full ordered id list).
  function scheduleSave() {
    pendingSave.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      setReordering(true);
      reorderCategoriesAction(orderRef.current.map((c) => c.id)).finally(() => {
        setReordering(false);
        pendingSave.current = false;
        router.refresh();
      });
    }, 400);
  }
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  // Keyboard equivalent of the drag: swap with a neighbour, same debounced
  // persist. Kept so pointer drag is never the only way to reorder.
  function move(index: number, delta: 1 | -1) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    scheduleSave();
  }

  return (
    <div className="space-y-6">
      <AddCategory />

      {categories.length === 0 ? (
        <Card className="border-dashed text-center p-8">
          <p className="text-muted mb-4">
            No categories yet. Add one above (e.g. Burgers, Drinks), then add items to it
            from the Items tab — or load a sample menu to start from.
          </p>
          <div className="flex justify-center">
            <LoadSampleButton variant="inline" />
          </div>
        </Card>
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="px-5 py-3 border-b border-line flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold tracking-tight">Categories</h2>
            <span className="text-xs text-muted">Order here is the order customers see.</span>
          </div>
          <Reorder.Group as="ul" axis="y" values={order} onReorder={setOrder} className="divide-y divide-line">
            {order.map((cat, i) => (
              <CategoryRow
                key={cat.id}
                category={cat}
                stations={kitchenStations}
                onMoveUp={i > 0 ? () => move(i, -1) : undefined}
                onMoveDown={i < order.length - 1 ? () => move(i, 1) : undefined}
                onDragEnd={scheduleSave}
                reordering={reordering}
              />
            ))}
          </Reorder.Group>
        </Card>
      )}

      <StationsEditor stations={kitchenStations} />

      <DangerZone restaurantName={restaurantName} categoryCount={categories.length} />
    </div>
  );
}

function AddCategory() {
  const [state, action] = useActionState(createCategory, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && !state.error) ref.current?.reset();
  }, [state]);

  return (
    <Card data-tour="menu-add-category">
      <h2 className="font-display text-lg font-semibold tracking-tight mb-4">Add a category</h2>
      <form ref={ref} action={action} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="cat-name">Category name</Label>
          <Input id="cat-name" name="name" placeholder="Burgers" required maxLength={60} />
        </div>
        <div className="w-[160px]">
          <SubmitButton pendingLabel="Adding…">Add category</SubmitButton>
        </div>
      </form>
      {state.error && (
        <div className="mt-3">
          <FormMessage tone="error">{state.error}</FormMessage>
        </div>
      )}
    </Card>
  );
}

function CategoryRow({
  category,
  stations,
  onMoveUp,
  onMoveDown,
  onDragEnd,
  reordering,
}: {
  category: MenuCategoryRow;
  stations: string[];
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDragEnd: () => void;
  reordering: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const reduced = useReducedMotion();
  // Drag starts ONLY from the grab handle (dragListener={false} below) — the
  // row is full of inputs/buttons that must keep working with the pointer.
  const dragControls = useDragControls();
  const [dragging, setDragging] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(category.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renamePending, startRename] = useTransition();

  const [confirming, setConfirming] = useState(false);
  const [deletePending, startDelete] = useTransition();

  const [station, setStation] = useState(category.station ?? "");
  const [from, setFrom] = useState(category.availableFrom ?? "");
  const [to, setTo] = useState(category.availableTo ?? "");
  const [optsPending, startOpts] = useTransition();
  const [optsSaved, setOptsSaved] = useState(false);

  const count = category.items.length;

  function saveName() {
    const next = nameDraft.trim();
    setEditingName(false);
    if (!next || next === category.name) {
      setNameDraft(category.name);
      return;
    }
    setRenameError(null);
    startRename(async () => {
      const res = await renameCategoryAction(category.id, next);
      if (res?.error) {
        setNameDraft(category.name);
        setRenameError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    startDelete(async () => {
      const res = await deleteCategoryAction(category.id);
      if ("error" in res && res.error) {
        toast.show(res.error, "error");
        setConfirming(false);
        return;
      }
      toast.show(`Deleted ${category.name}`);
      router.refresh();
    });
  }

  function saveOptions(next?: { station?: string }) {
    setOptsSaved(false);
    startOpts(async () => {
      const res = await updateCategoryOptions(category.id, {
        station: next?.station ?? station,
        availableFrom: from,
        availableTo: to,
      });
      if (res?.error) {
        toast.show(res.error, "error");
        return;
      }
      router.refresh();
      setOptsSaved(true);
    });
  }

  // The category's saved station might not be in the venue's current list
  // (renamed/removed elsewhere) — still offer it so the picker doesn't
  // silently discard it on the next save.
  const stationOptions = station && !stations.includes(station) ? [station, ...stations] : stations;

  return (
    <Reorder.Item
      as="li"
      value={category}
      dragListener={false}
      dragControls={dragControls}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => {
        setDragging(false);
        onDragEnd();
      }}
      // Lifted state: float shadow + a 2% scale (scale is skipped under
      // reduced motion; the shadow alone still marks the row as picked up).
      // --ease-spring / --dur-fast for the settle back down.
      whileDrag={{ scale: reduced ? 1 : 1.02 }}
      transition={{ duration: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
      className={`group relative px-5 py-4 bg-surface ${dragging ? "z-10 shadow-float rounded-[var(--radius-card)]" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0 flex items-center">
          {/* 6-dot grab handle. 44x44 hit target (this reorders on the staff
              iPad too); touch-none so the browser doesn't scroll instead of
              dragging. */}
          <button
            type="button"
            aria-label={`Drag to reorder ${category.name}`}
            disabled={reordering}
            onPointerDown={(e) => {
              if (reordering) return;
              e.preventDefault();
              dragControls.start(e);
            }}
            className={`w-11 h-11 -ml-2 rounded-[var(--radius-sm)] flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 touch-none select-none disabled:opacity-30 ${
              dragging ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor" aria-hidden>
              <circle cx="7" cy="4.5" r="1.6" />
              <circle cx="13" cy="4.5" r="1.6" />
              <circle cx="7" cy="10" r="1.6" />
              <circle cx="13" cy="10" r="1.6" />
              <circle cx="7" cy="15.5" r="1.6" />
              <circle cx="13" cy="15.5" r="1.6" />
            </svg>
          </button>
          {/* Keyboard reorder: hidden until the row is focused (or hovered on
              a pointer device), so drag is never the only way to move a row. */}
          <div className="flex flex-col -my-1 opacity-0 focus-within:opacity-100 group-hover:opacity-100 transition-opacity duration-[var(--dur-fast)]">
            <button
              type="button"
              disabled={!onMoveUp || reordering}
              onClick={onMoveUp}
              title="Move up"
              aria-label={`Move ${category.name} up`}
              className="w-7 h-6 rounded-[var(--radius-sm)] flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12l5-5 5 5" />
              </svg>
            </button>
            <button
              type="button"
              disabled={!onMoveDown || reordering}
              onClick={onMoveDown}
              title="Move down"
              aria-label={`Move ${category.name} down`}
              className="w-7 h-6 rounded-[var(--radius-sm)] flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 8l5 5 5-5" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {editingName ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveName();
                  } else if (e.key === "Escape") {
                    setNameDraft(category.name);
                    setEditingName(false);
                  }
                }}
                maxLength={60}
                aria-label="Category name"
                className="font-medium bg-surface rounded-[var(--radius-sm)] px-2 py-1 -ml-2 border border-line focus:border-pine focus:outline-none focus:ring-[3px] focus:ring-pine/20 max-w-[260px]"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setNameDraft(category.name);
                  setEditingName(true);
                }}
                title="Rename"
                className="font-medium truncate text-left hover:text-pine"
              >
                {category.name}
              </button>
            )}
            <span className="shrink-0 text-xs text-muted bg-surface-2 rounded-pill px-2 py-0.5 tabular-nums">
              {count} item{count === 1 ? "" : "s"}
            </span>
            {renamePending && <span className="shrink-0 text-xs text-muted">saving…</span>}
          </div>
          {renameError && <p className="text-xs text-danger mt-1">{renameError}</p>}
        </div>

        <div className="shrink-0">
          {confirming ? (
            <span className="inline-flex items-center gap-2">
              <span className="text-xs text-muted hidden sm:inline">
                {count > 0 ? `Delete with ${count} item${count === 1 ? "" : "s"}?` : "Delete?"}
              </span>
              <Button type="button" variant="danger" size="sm" onClick={remove} loading={deletePending}>
                Delete
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={deletePending}>
                Cancel
              </Button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNameDraft(category.name);
                  setEditingName(true);
                }}
              >
                Rename
              </Button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="h-9 px-3 rounded-[var(--radius-sm)] text-sm text-muted hover:text-danger hover:bg-danger-soft transition-colors"
              >
                Delete
              </button>
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 ml-12 flex flex-wrap items-end gap-3">
        <div className="w-[180px]">
          <label htmlFor={`station-${category.id}`} className="text-xs text-muted block mb-1">
            Station default
          </label>
          <select
            id={`station-${category.id}`}
            value={station}
            disabled={optsPending}
            onChange={(e) => {
              setStation(e.target.value);
              saveOptions({ station: e.target.value });
            }}
            className={SELECT_CLASS}
          >
            <option value="">Default board</option>
            {stationOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="w-[120px]">
          <label htmlFor={`from-${category.id}`} className="text-xs text-muted block mb-1">
            Available from
          </label>
          <input
            id={`from-${category.id}`}
            type="time"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={TIME_CLASS}
          />
        </div>
        <div className="w-[120px]">
          <label htmlFor={`to-${category.id}`} className="text-xs text-muted block mb-1">
            until
          </label>
          <input
            id={`to-${category.id}`}
            type="time"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={TIME_CLASS}
          />
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => saveOptions()} loading={optsPending}>
          {optsSaved ? "Saved" : "Save hours"}
        </Button>
        <p className="w-full text-xs text-muted">
          Leave times blank for all-day. Items in this category go to the station above unless
          an item sets its own.
        </p>
      </div>
    </Reorder.Item>
  );
}

// The venue's own list of kitchen prep stations (e.g. Kitchen, Barista,
// Grill) — offered as choices everywhere a category or item picks a station,
// and on the kitchen screen's station tabs.
function StationsEditor({ stations }: { stations: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [list, setList] = useState(stations);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No client-side cap — the server is the authority on how many stations
  // this plan allows (see updateKitchenStations -> canCreateStation in
  // lib/entitlements.ts). Optimistically shows the new list, then rolls
  // back and surfaces the reason if the server refuses it.
  function save(next: string[], previous: string[]) {
    setSaved(false);
    setError(null);
    start(async () => {
      const res = await updateKitchenStations(next);
      if (res?.error) {
        setList(previous);
        setError(res.error);
        return;
      }
      router.refresh();
      setSaved(true);
    });
  }

  function add() {
    const name = draft.trim();
    if (!name || list.includes(name)) return;
    const previous = list;
    const next = [...list, name];
    setList(next);
    setDraft("");
    save(next, previous);
  }

  function remove(name: string) {
    const previous = list;
    const next = list.filter((s) => s !== name);
    setList(next);
    save(next, previous);
  }

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold tracking-tight mb-1">Kitchen stations</h2>
      <p className="text-sm text-muted mb-4">
        Define your prep stations (e.g. Barista, Grill, Oven). Each category or item can be
        routed to one, and the kitchen screen gets a tab per station.
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {list.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-paper px-3 py-1 text-sm"
          >
            {s}
            <button
              type="button"
              disabled={pending}
              onClick={() => remove(s)}
              className="text-muted hover:text-danger disabled:opacity-50"
              aria-label={`Remove ${s}`}
            >
              <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-xs">
          <Label htmlFor="new-station">Add a station</Label>
          <Input
            id="new-station"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="e.g. Barista"
            maxLength={24}
          />
        </div>
        <Button type="button" variant="secondary" onClick={add} disabled={pending || !draft.trim()}>
          Add
        </Button>
        {saved && <span className="text-xs text-muted pb-3">Saved</span>}
      </div>
      {error && <p className="text-xs text-danger mt-2">{error}</p>}
    </Card>
  );
}
