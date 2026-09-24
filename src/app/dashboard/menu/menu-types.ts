// Plain module (no "use client"/"use server") so the server data loader and
// every client view share one shape. Mirrors the select in menu-list-data.tsx.
import type { ModGroup } from "./modifier-editor";

export type MenuItemRow = {
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

export type MenuCategoryRow = {
  id: string;
  name: string;
  icon: string | null;
  station: string | null;
  availableFrom: string | null;
  availableTo: string | null;
  items: MenuItemRow[];
};

export type MenuView = "items" | "categories";
