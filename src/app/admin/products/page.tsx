import { requirePlatformAdmin } from "@/lib/platform-admin";
import { listStandProducts } from "@/lib/admin/queries";
import { formatCents } from "@/lib/money";
import { createStandProduct, updateStandProduct } from "./actions";
import { ProductForm } from "./product-form";
import { ProductImageUploader } from "./image-uploader";
import { ActiveToggle } from "./active-toggle";

export default async function ProductsPage() {
  await requirePlatformAdmin();

  const products = await listStandProducts();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Stand products
        </h1>
        <p className="text-muted mt-1">
          The catalog venues pick from on their "Order Tillz stands" screen.
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight mb-4">
          Add a product
        </h2>
        <ProductForm
          action={createStandProduct}
          defaults={{ title: "", description: "", type: "QR", priceDollars: "", sortOrder: products.length }}
          submitLabel="Add product"
          resetOnSuccess
        />
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-muted">No products yet — add one above.</p>
      ) : (
        <div className="space-y-4">
          {products.map((p) => (
            <div
              key={p.id}
              className={`rounded-[var(--radius-card)] border bg-surface p-6 space-y-4 ${
                p.active ? "border-line" : "border-line opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{p.title}</span>
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-paper text-muted">
                    {p.type}
                  </span>
                  <span className="text-xs text-muted">{formatCents(p.priceCents)}</span>
                  {!p.active && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-danger-soft text-danger">
                      Retired
                    </span>
                  )}
                </div>
                <ActiveToggle productId={p.id} active={p.active} />
              </div>

              <ProductImageUploader productId={p.id} imageUrl={p.imageUrl} />

              <ProductForm
                action={updateStandProduct.bind(null, p.id)}
                defaults={{
                  title: p.title,
                  description: p.description,
                  type: p.type,
                  priceDollars: (p.priceCents / 100).toFixed(2),
                  sortOrder: p.sortOrder,
                }}
                submitLabel="Save changes"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
