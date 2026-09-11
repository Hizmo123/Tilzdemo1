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
  type MenuActionState,
} from "./actions";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatCents } from "@/lib/money";
import { ALLERGEN_OPTIONS } from "@/lib/allergens";
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
  modifierGroups: ModGroup[];
};
type Category = {
  id: string;
  name: string;
  station: string | null;
  availableFrom: string | null;
  availableTo: string | null;
  items: Item[];
};

const initial: MenuActionState = {};

export function MenuEditor({
  categories,
  currency,
}: {
  categories: Category[];
  currency: string;
}) {
  return (
    <div className="space-y-8">
      <AddCategory />
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
          <CategoryBlock key={cat.id} category={cat} currency={currency} />
        ))
      )}
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
}: {
  category: Category;
  currency: string;
}) {
  const [state, action] = useActionState(createItem, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && !state.error) ref.current?.reset();
  }, [state]);

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <h3 className="font-display text-xl font-semibold tracking-tight mb-3">
        {category.name}
      </h3>

      <CategoryOptions category={category} />

      {category.items.length > 0 && (
        <ul className="divide-y divide-line mb-5">
          {category.items.map((item) => (
            <ItemRow key={item.id} item={item} currency={currency} />
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

function ItemRow({ item, currency }: { item: Item; currency: string }) {
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
      <AllergenEditor itemId={item.id} allergens={item.allergens} />
      <ModifierEditor
        itemId={item.id}
        currency={currency}
        groups={item.modifierGroups}
      />
    </li>
  );
}

// Per-category prep station + availability window.
function CategoryOptions({ category }: { category: Category }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [station, setStation] = useState(category.station ?? "");
  const [from, setFrom] = useState(category.availableFrom ?? "");
  const [to, setTo] = useState(category.availableTo ?? "");
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    start(async () => {
      await updateCategoryOptions(category.id, {
        station,
        availableFrom: from,
        availableTo: to,
      });
      router.refresh();
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 mb-4 rounded-lg bg-paper p-3">
      <div className="w-[140px]">
        <label className="text-xs text-muted block mb-1">Prep station</label>
        <input
          value={station}
          onChange={(e) => setStation(e.target.value)}
          placeholder="Kitchen / Bar"
          className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-pine focus:outline-none"
        />
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
        onClick={save}
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
