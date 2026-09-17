"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCategory,
  createItem,
  toggleItemAvailable,
  deleteItem,
  updateCategoryOptions,
  updateItemAllergens,
  updateCategoryIcon,
  updateItemBadges,
  updateItemStation,
  updateKitchenStations,
  type MenuActionState,
} from "./actions";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatCents } from "@/lib/money";
import { ALLERGEN_OPTIONS } from "@/lib/allergens";
import { BADGE_VALUES, BADGE_META, CATEGORY_ICON_SUGGESTIONS } from "@/lib/menu-badges";
import { ModifierEditor, type ModGroup } from "./modifier-editor";
import { ImageUploader } from "./image-uploader";
import { LoadSampleButton } from "../sample/load-sample-button";

type Item = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  available: boolean;
  imageUrl: string | null;
  allergens: string[];
  badges: string[];
  station: string | null;
  modifierGroups: ModGroup[];
};
type Category = {
  id: string;
  name: string;
  icon: string | null;
  station: string | null;
  availableFrom: string | null;
  availableTo: string | null;
  items: Item[];
};

const initial: MenuActionState = {};

export function MenuEditor({
  categories,
  currency,
  kitchenStations,
}: {
  categories: Category[];
  currency: string;
  kitchenStations: string[];
}) {
  return (
    <div className="space-y-8">
      <AddCategory />
      <StationsEditor stations={kitchenStations} />
      {categories.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center">
          <p className="text-muted mb-4">
            No categories yet. Add one above (e.g. Burgers, Drinks), then add
            items to it — or load a sample menu to start from.
          </p>
          <div className="flex justify-center">
            <LoadSampleButton variant="inline" />
          </div>
        </div>
      ) : (
        categories.map((cat) => (
          <CategoryBlock
            key={cat.id}
            category={cat}
            currency={currency}
            stations={kitchenStations}
          />
        ))
      )}
    </div>
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

  function save(next: string[]) {
    setSaved(false);
    start(async () => {
      await updateKitchenStations(next);
      router.refresh();
      setSaved(true);
    });
  }

  function add() {
    const name = draft.trim();
    if (!name || list.includes(name)) return;
    const next = [...list, name];
    setList(next);
    setDraft("");
    save(next);
  }

  function remove(name: string) {
    const next = list.filter((s) => s !== name);
    setList(next);
    save(next);
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <h2 className="font-display text-lg font-semibold tracking-tight mb-1">
        Kitchen stations
      </h2>
      <p className="text-sm text-muted mb-4">
        Define your prep stations (e.g. Barista, Grill, Oven) — each category
        or item below can be routed to one, and the kitchen screen gets a tab
        per station.
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {list.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-sm"
          >
            {s}
            <button
              disabled={pending}
              onClick={() => remove(s)}
              className="text-muted hover:text-danger disabled:opacity-50"
              aria-label={`Remove ${s}`}
            >
              ×
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
          />
        </div>
        <button
          disabled={pending || !draft.trim()}
          onClick={add}
          className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:border-ink/30 disabled:opacity-50"
        >
          Add
        </button>
        {saved && <span className="text-xs text-muted">Saved</span>}
      </div>
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
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <h2 className="font-display text-lg font-semibold tracking-tight mb-4">
        Add a category
      </h2>
      <form ref={ref} action={action} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="cat-name">Category name</Label>
          <Input id="cat-name" name="name" placeholder="Burgers" required />
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
    </div>
  );
}

function CategoryBlock({
  category,
  currency,
  stations,
}: {
  category: Category;
  currency: string;
  stations: string[];
}) {
  const [state, action] = useActionState(createItem, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && !state.error) ref.current?.reset();
  }, [state]);

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <h3 className="font-display text-xl font-semibold tracking-tight mb-3 flex items-center gap-2">
        {category.icon && <span>{category.icon}</span>}
        {category.name}
      </h3>

      <CategoryIconEditor category={category} />
      <CategoryOptions category={category} stations={stations} />

      {category.items.length > 0 && (
        <ul className="divide-y divide-line mb-5">
          {category.items.map((item) => (
            <ItemRow key={item.id} item={item} currency={currency} stations={stations} />
          ))}
        </ul>
      )}

      <form
        ref={ref}
        action={action}
        className="grid sm:grid-cols-[1fr_1fr_120px_auto] gap-3 items-end border-t border-line pt-5"
      >
        <input type="hidden" name="categoryId" value={category.id} />
        <div>
          <Label htmlFor={`name-${category.id}`}>Item</Label>
          <Input
            id={`name-${category.id}`}
            name="name"
            placeholder="Chicken Burger"
            required
          />
        </div>
        <div>
          <Label htmlFor={`desc-${category.id}`}>Description</Label>
          <Input
            id={`desc-${category.id}`}
            name="description"
            placeholder="Crispy chicken, house sauce"
          />
        </div>
        <div>
          <Label htmlFor={`price-${category.id}`}>Price</Label>
          <Input id={`price-${category.id}`} name="price" placeholder="24.00" required />
        </div>
        <div>
          <SubmitButton pendingLabel="…">Add</SubmitButton>
        </div>
      </form>
      {state.error && (
        <div className="mt-3">
          <FormMessage tone="error">{state.error}</FormMessage>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  currency,
  stations,
}: {
  item: Item;
  currency: string;
  stations: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${item.available ? "" : "text-muted line-through"}`}>
              {item.name}
            </span>
            {!item.available && (
              <span className="text-[10px] uppercase tracking-wide bg-paper text-muted px-1.5 py-0.5 rounded">
                Sold out
              </span>
            )}
          </div>
          {item.description && (
            <p className="text-sm text-muted truncate">{item.description}</p>
          )}
        </div>
        <span className="tabular-nums text-sm font-medium">
          {formatCents(item.priceCents, currency)}
        </span>
        <button
          disabled={pending}
          onClick={() => run(() => toggleItemAvailable(item.id, !item.available))}
          className="text-xs rounded-md border border-line px-2.5 py-1 hover:border-ink/30 disabled:opacity-50 transition-colors"
        >
          {item.available ? "Mark sold out" : "Mark available"}
        </button>
        <button
          disabled={pending}
          onClick={() => run(() => deleteItem(item.id))}
          className="text-xs text-muted hover:text-danger disabled:opacity-50 transition-colors"
        >
          Delete
        </button>
      </div>
      <div className="mt-3">
        <ImageUploader itemId={item.id} imageUrl={item.imageUrl} />
      </div>
      <BadgeEditor itemId={item.id} badges={item.badges} />
      <AllergenEditor itemId={item.id} allergens={item.allergens} />
      <ItemStationPicker itemId={item.id} station={item.station} stations={stations} />
      <ModifierEditor
        itemId={item.id}
        currency={currency}
        groups={item.modifierGroups}
      />
    </li>
  );
}

// A one-tap emoji for the category, shown on the customer menu right next to
// its name — the cheapest way to make a category feel like this venue's own,
// no image upload required.
function CategoryIconEditor({ category }: { category: Category }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [icon, setIcon] = useState(category.icon ?? "");

  function set(next: string) {
    setIcon(next);
    start(async () => {
      await updateCategoryIcon(category.id, next);
      router.refresh();
    });
  }

  return (
    <div className="mb-4">
      <p className="text-xs text-muted mb-1.5">Category icon (optional)</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {CATEGORY_ICON_SUGGESTIONS.map((e) => (
          <button
            key={e}
            disabled={pending}
            onClick={() => set(icon === e ? "" : e)}
            className={`w-8 h-8 rounded-lg border text-base flex items-center justify-center transition-colors disabled:opacity-60 ${
              icon === e ? "border-pine bg-pine-soft" : "border-line hover:border-ink/30"
            }`}
          >
            {e}
          </button>
        ))}
        <input
          value={icon}
          onChange={(e) => set(e.target.value)}
          placeholder="or type any emoji"
          className="w-32 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm focus:border-pine focus:outline-none"
        />
      </div>
    </div>
  );
}

// Per-category prep station + availability window.
function CategoryOptions({ category, stations }: { category: Category; stations: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [station, setStation] = useState(category.station ?? "");
  const [from, setFrom] = useState(category.availableFrom ?? "");
  const [to, setTo] = useState(category.availableTo ?? "");
  const [saved, setSaved] = useState(false);

  function save(next?: { station?: string }) {
    setSaved(false);
    start(async () => {
      await updateCategoryOptions(category.id, {
        station: next?.station ?? station,
        availableFrom: from,
        availableTo: to,
      });
      router.refresh();
      setSaved(true);
    });
  }

  // The category's saved station might not be in the venue's current list
  // (renamed/removed elsewhere) — still offer it so the picker doesn't
  // silently discard it on the next save.
  const options = station && !stations.includes(station) ? [station, ...stations] : stations;

  return (
    <div className="flex flex-wrap items-end gap-3 mb-4 rounded-lg bg-paper p-3">
      <div className="w-[160px]">
        <label className="text-xs text-muted block mb-1">Prep station</label>
        <select
          value={station}
          onChange={(e) => {
            setStation(e.target.value);
            save({ station: e.target.value });
          }}
          className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-pine focus:outline-none"
        >
          <option value="">Default board</option>
          {options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="w-[110px]">
        <label className="text-xs text-muted block mb-1">Available from</label>
        <input
          type="time"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-pine focus:outline-none"
        />
      </div>
      <div className="w-[110px]">
        <label className="text-xs text-muted block mb-1">until</label>
        <input
          type="time"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-pine focus:outline-none"
        />
      </div>
      <button
        disabled={pending}
        onClick={() => save()}
        className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink/30 disabled:opacity-50"
      >
        {pending ? "…" : saved ? "Saved" : "Save"}
      </button>
      <p className="w-full text-xs text-muted">
        Leave times blank for all-day. A station routes this category to its own
        kitchen board tab.
      </p>
    </div>
  );
}

// Per-item prep station override — defaults to "same as category" (station
// === "") so most items need no attention; only the exceptions get set.
function ItemStationPicker({
  itemId,
  station,
  stations,
}: {
  itemId: string;
  station: string | null;
  stations: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(station ?? "");

  const options = value && !stations.includes(value) ? [value, ...stations] : stations;

  function change(next: string) {
    setValue(next);
    start(async () => {
      await updateItemStation(itemId, next);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <label className="text-xs text-muted">Route to</label>
      <select
        disabled={pending}
        value={value}
        onChange={(e) => change(e.target.value)}
        className="rounded-md border border-line bg-paper px-2 py-1 text-sm focus:border-pine focus:outline-none disabled:opacity-50"
      >
        <option value="">Same as category</option>
        {options.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}

// Per-item merchandising badges (Popular, New, Chef's pick, dietary tags).
function BadgeEditor({ itemId, badges }: { itemId: string; badges: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<string[]>(badges);

  function toggle(b: string) {
    const next = sel.includes(b) ? sel.filter((x) => x !== b) : [...sel, b];
    setSel(next);
    start(async () => {
      await updateItemBadges(itemId, next);
      router.refresh();
    });
  }

  return (
    <div className="mt-3">
      <p className="text-xs text-muted mb-1.5">Badges</p>
      <div className="flex flex-wrap gap-1.5">
        {BADGE_VALUES.map((b) => {
          const meta = BADGE_META[b];
          const on = sel.includes(b);
          return (
            <button
              key={b}
              disabled={pending}
              onClick={() => toggle(b)}
              className={`text-xs rounded-full border px-2.5 py-1 transition-colors disabled:opacity-60 ${
                on
                  ? "border-pine bg-pine-soft text-pine-deep"
                  : "border-line text-muted hover:border-ink/30"
              }`}
            >
              {meta.emoji} {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Per-item allergen tags.
function AllergenEditor({
  itemId,
  allergens,
}: {
  itemId: string;
  allergens: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<string[]>(allergens);

  function toggle(a: string) {
    const next = sel.includes(a) ? sel.filter((x) => x !== a) : [...sel, a];
    setSel(next);
    start(async () => {
      await updateItemAllergens(itemId, next);
      router.refresh();
    });
  }

  return (
    <div className="mt-3">
      <p className="text-xs text-muted mb-1.5">Allergens</p>
      <div className="flex flex-wrap gap-1.5">
        {ALLERGEN_OPTIONS.map((a) => {
          const on = sel.includes(a);
          return (
            <button
              key={a}
              disabled={pending}
              onClick={() => toggle(a)}
              className={`text-xs rounded-full border px-2.5 py-1 transition-colors disabled:opacity-60 ${
                on
                  ? "border-pine bg-pine-soft text-pine-deep"
                  : "border-line text-muted hover:border-ink/30"
              }`}
            >
              {a}
            </button>
          );
        })}
      </div>
    </div>
  );
}
