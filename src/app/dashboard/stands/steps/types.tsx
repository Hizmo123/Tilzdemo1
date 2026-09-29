export type ProductRow = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  type: "QR" | "NFC";
  priceCents: number;
  hasCardInsert: boolean;
  allowsCustomDesign: boolean;
  requiresCustomDesign: boolean;
  designGuidelines: string | null;
  maxDesignSizeMb: number;
  acceptedDesignMimeTypes: string[];
};

export type TableRow = {
  id: string;
  label: string;
  section: string | null;
  hasStand: boolean;
};

export type StagedDesign = { url: string; fileName: string };

export type ShippingValues = {
  name: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
};

export const EMPTY_SHIPPING: ShippingValues = { name: "", address: "", suburb: "", state: "", postcode: "" };

export function shippingComplete(s: ShippingValues): boolean {
  return Object.values(s).every((v) => v.trim().length > 0);
}

export function TypeChip({ type }: { type: ProductRow["type"] }) {
  return (
    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-paper text-muted">
      {type}
    </span>
  );
}
