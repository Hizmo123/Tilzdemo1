"use client";

import { useActionState, useEffect, useState } from "react";
import { LayoutGroup } from "motion/react";
import { orderStands, type StandOrderActionState } from "./actions";
import { uploadStandOrderDesign } from "./design-actions";
import { formatCents } from "@/lib/money";
import { BRAND } from "@/lib/brand";
import { CardPreview, type CardPalette } from "./card-preview";
import { StepShell, type StepStatus } from "./steps/step-shell";
import { ProductStep } from "./steps/product-step";
import { CardDesignStep, type HeadlineMode } from "./steps/card-design-step";
import { ArtworkStep } from "./steps/artwork-step";
import { TablesStep } from "./steps/tables-step";
import { ShippingStep } from "./steps/shipping-step";
import { OrderSummary, OrderBottomBar } from "./order-summary-rail";
import {
  EMPTY_SHIPPING,
  shippingComplete,
  type ProductRow,
  type TableRow,
  type StagedDesign,
  type ShippingValues,
} from "./steps/types";

const initial: StandOrderActionState = {};

type StepKey = "product" | "card" | "artwork" | "tables" | "shipping";

// Which steps a given product needs. Product and tables/shipping always;
// the card step only when the product ships with a card insert; artwork
// only when the admin allows a custom design for it (which itself implies
// a card insert — see admin/products/actions.ts).
function stepsFor(product: ProductRow | null): StepKey[] {
  const steps: StepKey[] = ["product"];
  if (product?.hasCardInsert) steps.push("card");
  if (product?.allowsCustomDesign) steps.push("artwork");
  steps.push("tables", "shipping");
  return steps;
}

const STEP_TITLES: Record<StepKey, string> = {
  product: "Product",
  card: "Card design",
  artwork: "Your artwork",
  tables: "Tables",
  shipping: "Shipping",
};

// The stepped configurator. All state lives here; each step is a dumb
// controlled component under ./steps, and every value orderStands reads is
// posted through the hidden inputs at the bottom — so a step collapsing
// (its inputs unmounting) never drops a value from the FormData. The field
// names and the server action are unchanged from the single-form version.
export function OrderStandsForm({
  products,
  tables,
  restaurantName,
}: {
  products: ProductRow[];
  tables: TableRow[];
  restaurantName: string;
}) {
  const [state, action] = useActionState(orderStands, initial);

  const [productId, setProductId] = useState<string | null>(null);
  const [cardTemplate, setCardTemplate] = useState<CardPalette>("dark");
  // Default is generic "TILLZ" branding, not the venue's own name — matches
  // the schema default (StandCardHeadline.TILLZ_DEFAULT) so a venue has to
  // opt into printing their own name on the card.
  const [cardHeadlineMode, setCardHeadlineMode] = useState<HeadlineMode>("TILLZ_DEFAULT");
  // The card step is complete on arrival (both controls have defaults) but
  // is still shown expanded once so the choice is actually seen; "Looks
  // good" flips this.
  const [cardConfirmed, setCardConfirmed] = useState(false);
  const [design, setDesign] = useState<StagedDesign | null>(null);
  const [designSkipped, setDesignSkipped] = useState(false);
  const [designUploading, setDesignUploading] = useState(false);
  const [designError, setDesignError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [shipping, setShipping] = useState<ShippingValues>(EMPTY_SHIPPING);
  const [activeStep, setActiveStep] = useState<StepKey>("product");
  const [previewOpen, setPreviewOpen] = useState(false);

  const selectedProduct = products.find((p) => p.id === productId) ?? null;
  const steps = stepsFor(selectedProduct);
  const headlineText = cardHeadlineMode === "VENUE_NAME" ? restaurantName : "TILLZ";
  const totalCents = selectedProduct ? selectedProduct.priceCents * checked.size : 0;

  function isComplete(key: StepKey, product: ProductRow | null = selectedProduct): boolean {
    switch (key) {
      case "product":
        return product !== null;
      case "card":
        return cardConfirmed;
      case "artwork":
        return design !== null || designSkipped;
      case "tables":
        return checked.size > 0;
      case "shipping":
        return shippingComplete(shipping);
    }
  }

  // After completing `from`, open the next step that still needs input; if
  // everything after it is already done (a "Change" round-trip), land on
  // the last step so there's always exactly one open.
  function advanceFrom(from: StepKey, product: ProductRow | null = selectedProduct, overrides: Partial<Record<StepKey, boolean>> = {}) {
    const list = stepsFor(product);
    const after = list.slice(list.indexOf(from) + 1);
    const next = after.find((k) => !(overrides[k] ?? isComplete(k, product)));
    setActiveStep(next ?? list[list.length - 1]);
  }

  function statusOf(key: StepKey): StepStatus {
    if (key === activeStep) return "active";
    return isComplete(key) ? "complete" : "locked";
  }

  useEffect(() => {
    if (!previewOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [previewOpen]);

  useEffect(() => {
    if (state?.success) {
      setProductId(null);
      setCardTemplate("dark");
      setCardHeadlineMode("TILLZ_DEFAULT");
      setCardConfirmed(false);
      setDesign(null);
      setDesignSkipped(false);
      setDesignError(null);
      setChecked(new Set());
      setShipping(EMPTY_SHIPPING);
      setActiveStep("product");
    }
  }, [state]);

  function selectProduct(id: string) {
    const product = products.find((p) => p.id === id) ?? null;
    if (id !== productId) {
      // A design staged against product A's guidelines/limits has no
      // guaranteed relevance to product B, and a card choice never confirmed
      // for this product should be shown again.
      setDesign(null);
      setDesignSkipped(false);
      setDesignError(null);
      setCardConfirmed(false);
    }
    setProductId(id);
    advanceFrom("product", product, id !== productId ? { card: false, artwork: false } : {});
  }

  function confirmCard() {
    setCardConfirmed(true);
    advanceFrom("card", selectedProduct, { card: true });
  }

  async function pickDesignFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedProduct) return;
    setDesignError(null);
    setDesignUploading(true);
    const res = await uploadStandOrderDesign(selectedProduct.id, fd(file));
    setDesignUploading(false);
    if ("error" in res) {
      setDesignError(res.error);
      return;
    }
    setDesign(res);
    advanceFrom("artwork", selectedProduct, { artwork: true });
  }

  function skipDesign() {
    setDesignSkipped(true);
    advanceFrom("artwork", selectedProduct, { artwork: true });
  }

  function toggleTable(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllWithoutStand() {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const t of tables) if (!t.hasStand) next.add(t.id);
      return next;
    });
  }

  if (tables.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface p-8 text-center">
        <p className="text-muted">Add a table first before ordering stands.</p>
      </div>
    );
  }

  const firstIncomplete = steps.find((k) => !isComplete(k)) ?? null;
  const blocker = firstIncomplete ? blockerFor(firstIncomplete, selectedProduct) : null;

  const summary = {
    product: selectedProduct,
    count: checked.size,
    cardLine: selectedProduct?.hasCardInsert
      ? `${cardTemplate === "dark" ? "Dark" : "Light"} · “${headlineText}”`
      : null,
    artworkName: selectedProduct?.allowsCustomDesign ? (design?.fileName ?? null) : null,
    totalCents,
    blocker,
    error: state.error,
    success: state.success,
  };

  const stepSummaries: Record<StepKey, string> = {
    product: selectedProduct ? `${selectedProduct.title} · ${formatCents(selectedProduct.priceCents)} each` : "",
    card: `${cardTemplate === "dark" ? "Dark" : "Light"} template · ${
      cardHeadlineMode === "VENUE_NAME" ? "Your venue name" : `${BRAND.name} branding`
    }`,
    artwork: design ? design.fileName : `${BRAND.name} design`,
    tables: `${checked.size} table${checked.size === 1 ? "" : "s"}`,
    shipping: [shipping.name, `${shipping.suburb} ${shipping.state} ${shipping.postcode}`.trim()].filter(Boolean).join(", "),
  };

  return (
    <>
      <form action={action} className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8 lg:items-start">
        <LayoutGroup>
          <div className="space-y-4 min-w-0">
            {steps.map((key, i) => (
              <StepShell
                key={key}
                number={i + 1}
                title={STEP_TITLES[key]}
                status={statusOf(key)}
                summary={stepSummaries[key]}
                onChange={() => setActiveStep(key)}
              >
                {key === "product" && (
                  <ProductStep products={products} selectedId={productId} onSelect={selectProduct} />
                )}
                {key === "card" && (
                  <CardDesignStep
                    template={cardTemplate}
                    onTemplate={setCardTemplate}
                    headlineMode={cardHeadlineMode}
                    onHeadlineMode={setCardHeadlineMode}
                    headlineText={headlineText}
                    restaurantName={restaurantName}
                    onPreview={() => setPreviewOpen(true)}
                    onConfirm={confirmCard}
                  />
                )}
                {key === "artwork" && selectedProduct && (
                  <ArtworkStep
                    product={selectedProduct}
                    design={design}
                    uploading={designUploading}
                    error={designError}
                    onPickFile={pickDesignFile}
                    onRemove={() => setDesign(null)}
                    onSkip={skipDesign}
                    onContinue={() => advanceFrom("artwork", selectedProduct, { artwork: true })}
                  />
                )}
                {key === "tables" && (
                  <TablesStep
                    tables={tables}
                    checked={checked}
                    onToggle={toggleTable}
                    onSelectAllWithoutStand={selectAllWithoutStand}
                    onContinue={() => advanceFrom("tables", selectedProduct, { tables: true })}
                  />
                )}
                {key === "shipping" && <ShippingStep value={shipping} onChange={setShipping} />}
              </StepShell>
            ))}

            {/* Below lg the summary sits in flow here, with the CTA in the
                sticky bar underneath; from lg it's the rail on the right. */}
            <div className="lg:hidden">
              <OrderSummary {...summary} showCta={false} />
            </div>
          </div>
        </LayoutGroup>

        <aside className="hidden lg:block lg:sticky lg:top-6">
          <OrderSummary {...summary} showCta />
        </aside>

        <OrderBottomBar totalCents={totalCents} blocker={blocker} error={state.error} success={state.success} />

        {/* Everything orderStands reads, always mounted regardless of which
            step is open. Same names as before the stepped layout. */}
        <input type="hidden" name="productId" value={productId ?? ""} />
        {[...checked].map((id) => (
          <input key={id} type="hidden" name="tableIds" value={id} />
        ))}
        <input type="hidden" name="cardTemplate" value={cardTemplate === "dark" ? "DARK" : "LIGHT"} />
        <input type="hidden" name="cardHeadlineMode" value={cardHeadlineMode} />
        <input type="hidden" name="designImageUrl" value={design?.url ?? ""} />
        <input type="hidden" name="designFileName" value={design?.fileName ?? ""} />
        <input type="hidden" name="shippingName" value={shipping.name} />
        <input type="hidden" name="shippingAddress" value={shipping.address} />
        <input type="hidden" name="shippingSuburb" value={shipping.suburb} />
        <input type="hidden" name="shippingState" value={shipping.state} />
        <input type="hidden" name="shippingPostcode" value={shipping.postcode} />
      </form>

      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-6"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="relative"
            style={{ height: "min(85vh, 700px)", width: "calc(min(85vh, 700px) * 105 / 148)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              aria-label="Close preview"
              className="absolute -top-11 right-0 h-9 w-9 rounded-pill flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
            <CardPreview palette={cardTemplate} headlineText={headlineText} />
          </div>
        </div>
      )}
    </>
  );
}

function fd(file: File): FormData {
  const data = new FormData();
  data.append("file", file);
  return data;
}

function blockerFor(step: StepKey, product: ProductRow | null): string {
  switch (step) {
    case "product":
      return "Choose a product";
    case "card":
      return "Confirm your card design";
    case "artwork":
      return product?.requiresCustomDesign ? "Upload your artwork" : "Upload artwork or skip";
    case "tables":
      return "Pick at least one table";
    case "shipping":
      return "Enter a shipping address";
  }
}
