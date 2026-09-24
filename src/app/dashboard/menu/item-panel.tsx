"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label, Input, FormMessage } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { compressImage } from "@/lib/compress-image";
import { ALLERGEN_OPTIONS } from "@/lib/allergens";
import { BADGE_VALUES, BADGE_META } from "@/lib/menu-badges";
import { saveMenuItem } from "./actions";
import { uploadMenuImage, setMenuImageUrl } from "./image-actions";
import { ImageUploader } from "./image-uploader";
import { ModifierEditor } from "./modifier-editor";
import type { MenuCategoryRow, MenuItemRow } from "./menu-types";

// Same chrome as the Phase 0 Input (components/ui/field.tsx) for the native
// controls that component doesn't cover — select and textarea.
const FIELD_CLASS =
  "w-full rounded-[var(--radius-md)] bg-surface px-3.5 text-ink border border-line shadow-rest transition-[border-color,box-shadow] duration-[var(--dur-fast)] hover:border-line-strong focus:outline-none focus:border-pine focus:ring-[3px] focus:ring-pine/20";
const SELECT_CLASS = `${FIELD_CLASS} h-11`;
const TEXTAREA_CLASS = `${FIELD_CLASS} py-2.5 min-h-[88px] resize-y placeholder:text-muted/70`;

// One slide-over for both "Add item" and "Edit item". The parent keys this
// component on the item id (or "new"), so every open starts from the right
// initial state without any effect-based syncing.
export function ItemPanel({
  open,
  onClose,
  item,
  categories,
  defaultCategoryId,
  stations,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  item: MenuItemRow | null;
  categories: MenuCategoryRow[];
  defaultCategoryId: string | null;
  stations: string[];
  currency: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = item !== null;

  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item ? (item.priceCents / 100).toFixed(2) : "");
  const [categoryId, setCategoryId] = useState(
    item ? categoryIdOf(categories, item.id) : defaultCategoryId ?? categories[0]?.id ?? "",
  );
  const [station, setStation] = useState(item?.station ?? "");
  const [available, setAvailable] = useState(item?.available ?? true);
  const [badges, setBadges] = useState<string[]>(item?.badges ?? []);
  const [allergens, setAllergens] = useState<string[]>(item?.allergens ?? []);

  // Add mode stages the photo client-side (there's no item id to attach it
  // to until the save lands); edit mode hands off to ImageUploader, which
  // writes straight to the existing item.
  const fileRef = useRef<HTMLInputElement>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedPreview, setStagedPreview] = useState<string | null>(null);
  const [imageUrlDraft, setImageUrlDraft] = useState("");
  const [urlSaving, setUrlSaving] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  // The item's saved station might not be in the venue's current list
  // (renamed/removed since) — still offer it so a save doesn't silently drop it.
  const stationOptions = useMemo(
    () => (station && !stations.includes(station) ? [station, ...stations] : stations),
    [station, stations],
  );

  function pickStagedFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (stagedPreview) URL.revokeObjectURL(stagedPreview);
    setStagedFile(file);
    setStagedPreview(URL.createObjectURL(file));
    setImageUrlDraft("");
    setImageError(null);
  }

  function clearStaged() {
    if (stagedPreview) URL.revokeObjectURL(stagedPreview);
    setStagedFile(null);
    setStagedPreview(null);
  }

  // Edit mode only: the URL input writes immediately, same as ImageUploader's
  // file path does, so the preview beside it reflects the saved state.
  async function applyImageUrl() {
    if (!item) return;
    const url = imageUrlDraft.trim();
    if (!url) return;
    setImageError(null);
    setUrlSaving(true);
    const res = await setMenuImageUrl(item.id, url);
    setUrlSaving(false);
    if (res.error) {
      setImageError(res.error);
      return;
    }
    setImageUrlDraft("");
    router.refresh();
  }

  async function save() {
    setError(null);
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    setSaving(true);
    const res = await saveMenuItem({
      itemId: item?.id ?? null,
      categoryId,
      name,
      description,
      price,
      station,
      available,
      badges,
      allergens,
    });
    if ("error" in res) {
      setError(res.error);
      setSaving(false);
      return;
    }

    if (!editing) {
      // Item exists now — attach whichever photo input was used.
      try {
        if (stagedFile) {
          const blob = await compressImage(stagedFile);
          const fd = new FormData();
          fd.append("file", blob, "photo.jpg");
          const up = await uploadMenuImage(res.itemId, fd);
          if (up.error) toast.show(`Item added, but the photo didn't upload: ${up.error}`, "error");
        } else if (imageUrlDraft.trim()) {
          const up = await setMenuImageUrl(res.itemId, imageUrlDraft);
          if (up.error) toast.show(`Item added, but the photo URL was rejected: ${up.error}`, "error");
        }
      } catch {
        toast.show("Item added, but the photo couldn't be processed.", "error");
      }
    }

    toast.show(editing ? "Item saved" : "Item added");
    router.refresh();
    setSaving(false);
    clearStaged();
    onClose();
  }

  const previewUrl = editing ? item.imageUrl : stagedPreview ?? (imageUrlDraft.trim() || null);

  return (
    <Sheet
      open={open}
      onClose={saving ? () => {} : onClose}
      title={editing ? "Edit item" : "Add item"}
      size="lg"
      side="right"
      footer={
        <div className="flex items-center justify-end gap-2 pb-3">
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={save} loading={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add item"}
          </Button>
        </div>
      }
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!saving) save();
        }}
      >
        {/* Photo — file upload or a pasted URL. */}
        <section className="space-y-2">
          <Label>Photo</Label>
          <div className="flex items-start gap-3">
            <div className="w-20 h-20 rounded-[var(--radius-md)] overflow-hidden bg-paper border border-line shrink-0 flex items-center justify-center">
              {previewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[11px] text-muted text-center leading-tight px-1">No photo</span>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              {editing ? (
                <ImageUploader itemId={item.id} imageUrl={item.imageUrl} />
              ) : (
                <div className="flex items-center gap-2">
                  <input ref={fileRef} type="file" accept="image/*" onChange={pickStagedFile} className="hidden" />
                  <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    {stagedFile ? "Replace photo" : "Upload photo"}
                  </Button>
                  {stagedFile && (
                    <button type="button" onClick={clearStaged} className="text-xs text-muted hover:text-danger">
                      Remove
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  value={imageUrlDraft}
                  onChange={(e) => {
                    setImageUrlDraft(e.target.value);
                    if (!editing && stagedFile) clearStaged();
                  }}
                  placeholder="or paste an image URL"
                  className="h-9 text-sm"
                  aria-label="Image URL"
                />
                {editing && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={applyImageUrl}
                    loading={urlSaving}
                    disabled={!imageUrlDraft.trim()}
                  >
                    Use URL
                  </Button>
                )}
              </div>
              {imageError && <p className="text-xs text-danger">{imageError}</p>}
            </div>
          </div>
        </section>

        <div>
          <Label htmlFor="item-name">Name</Label>
          <Input
            id="item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Chicken Burger"
            required
            maxLength={80}
            autoFocus
          />
        </div>

        <div>
          <Label htmlFor="item-desc">Description</Label>
          <textarea
            id="item-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Crispy chicken, house sauce, pickles"
            maxLength={240}
            className={TEXTAREA_CLASS}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="item-price">Price ({currency})</Label>
            <Input
              id="item-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="24.00"
              inputMode="decimal"
              required
            />
          </div>
          <div>
            <Label htmlFor="item-category">Category</Label>
            <select
              id="item-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={SELECT_CLASS}
              required
            >
              {categories.length === 0 && <option value="">No categories yet</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Prep station — Tillz's own routing field, given a card of its own
            rather than a row in the grid so it can't be missed. */}
        <section className="rounded-[var(--radius-card)] border border-pine/30 bg-pine-tint p-4 space-y-3">
          <div>
            <Label htmlFor="item-station" className="mb-0.5">
              Prep station
            </Label>
            <p className="text-xs text-muted">
              Which kitchen board this item&apos;s ticket lands on. Most items follow their
              category; set this only for the exceptions.
            </p>
          </div>
          <select
            id="item-station"
            value={station}
            onChange={(e) => setStation(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">
              Use category&apos;s station
              {selectedCategory ? ` (${selectedCategory.station ?? "Default board"})` : ""}
            </option>
            {stationOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {stations.length === 0 && (
            <p className="text-xs text-muted">
              No stations defined yet — add them on the Categories tab under Kitchen stations.
            </p>
          )}
        </section>

        <div className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3">
          <div>
            <p className="text-sm font-medium">Available</p>
            <p className="text-xs text-muted">Off marks it sold out on the customer menu.</p>
          </div>
          <Switch checked={available} onChange={setAvailable} label="Available" />
        </div>

        <PillGroup
          label="Badges"
          options={BADGE_VALUES.map((b) => ({ value: b, label: BADGE_META[b].label }))}
          selected={badges}
          onChange={setBadges}
        />

        <PillGroup
          label="Allergens"
          options={ALLERGEN_OPTIONS.map((a) => ({ value: a, label: a }))}
          selected={allergens}
          onChange={setAllergens}
        />

        {/* Modifier groups + options stay in the same editing flow. They hang
            off a persisted item, so Add mode explains the one extra step. */}
        <section className="border-t border-line pt-5">
          <p className="text-sm font-medium">Options</p>
          {editing ? (
            <>
              <p className="text-xs text-muted mb-1">
                Choice groups like Sauce or Extras, each with its own options and price deltas.
                These save as you go.
              </p>
              <ModifierEditor itemId={item.id} currency={currency} groups={item.modifierGroups} />
            </>
          ) : (
            <p className="text-xs text-muted mt-1">
              Save this item first, then open it to add choice groups like Sauce or Extras.
            </p>
          )}
        </section>

        {error && <FormMessage tone="error">{error}</FormMessage>}
        {/* Enter submits the form without needing a visible submit button. */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}

function categoryIdOf(categories: MenuCategoryRow[], itemId: string): string {
  return categories.find((c) => c.items.some((i) => i.id === itemId))?.id ?? categories[0]?.id ?? "";
}

// Multi-select pills — the same small-pill look the badge/allergen editors
// have always used on this page, held in local state until Save.
function PillGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  }
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.value)}
              className={`min-h-[36px] text-xs rounded-pill border px-3 py-1.5 transition-colors ${
                on ? "border-pine bg-pine-soft text-pine-deep" : "border-line text-muted hover:border-line-strong"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-11 h-6 rounded-pill transition-colors duration-[var(--dur-fast)] focus:outline-none focus:ring-[3px] focus:ring-pine/20 disabled:opacity-50 ${
        checked ? "bg-pine" : "bg-line-strong"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-pill bg-surface shadow-rest transition-transform duration-[var(--dur-fast)] ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}
