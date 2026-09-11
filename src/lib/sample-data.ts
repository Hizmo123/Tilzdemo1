// A realistic small-café dataset used by the one-tap "Load a sample café"
// onboarding helper. Prices are in integer cents. This is illustrative starter
// content an owner then edits — not demo/fake runtime data.

export type SampleOption = { name: string; deltaCents?: number };
export type SampleGroup = {
  name: string;
  required?: boolean;
  maxSelect?: number;
  options: SampleOption[];
};
export type SampleItem = {
  name: string;
  description?: string;
  priceCents: number;
  groups?: SampleGroup[];
};
export type SampleCategory = { name: string; items: SampleItem[] };

export const SAMPLE_MENU: SampleCategory[] = [
  {
    name: "Coffee",
    items: [
      {
        name: "Flat White",
        description: "Double shot, silky milk",
        priceCents: 500,
        groups: [
          {
            name: "Milk",
            required: true,
            maxSelect: 1,
            options: [
              { name: "Full cream" },
              { name: "Skim" },
              { name: "Oat", deltaCents: 50 },
              { name: "Almond", deltaCents: 50 },
            ],
          },
          {
            name: "Size",
            required: true,
            maxSelect: 1,
            options: [{ name: "Regular" }, { name: "Large", deltaCents: 80 }],
          },
        ],
      },
      {
        name: "Latte",
        description: "Smooth and milky",
        priceCents: 500,
        groups: [
          {
            name: "Milk",
            required: true,
            maxSelect: 1,
            options: [
              { name: "Full cream" },
              { name: "Skim" },
              { name: "Oat", deltaCents: 50 },
            ],
          },
        ],
      },
      { name: "Long Black", description: "Two shots over water", priceCents: 450 },
      { name: "Cold Brew", description: "18-hour steep, served over ice", priceCents: 600 },
    ],
  },
  {
    name: "Food",
    items: [
      {
        name: "Smashed Avo",
        description: "Sourdough, lemon, chilli, feta",
        priceCents: 1800,
        groups: [
          {
            name: "Add extras",
            required: false,
            maxSelect: 3,
            options: [
              { name: "Poached egg", deltaCents: 300 },
              { name: "Bacon", deltaCents: 400 },
              { name: "Extra feta", deltaCents: 200 },
            ],
          },
        ],
      },
      {
        name: "Bacon & Egg Roll",
        description: "Milk bun, fried egg, streaky bacon",
        priceCents: 1200,
        groups: [
          {
            name: "Sauce",
            required: true,
            maxSelect: 1,
            options: [
              { name: "BBQ" },
              { name: "Tomato" },
              { name: "Aioli" },
              { name: "None" },
            ],
          },
        ],
      },
      {
        name: "Granola Bowl",
        description: "House granola, yoghurt, seasonal fruit",
        priceCents: 1400,
      },
    ],
  },
  {
    name: "Sweets",
    items: [
      {
        name: "Banana Bread",
        priceCents: 600,
        groups: [
          {
            name: "Serve",
            required: true,
            maxSelect: 1,
            options: [{ name: "Toasted with butter" }, { name: "As is" }],
          },
        ],
      },
      { name: "Blueberry Muffin", priceCents: 550 },
    ],
  },
  {
    name: "Cold Drinks",
    items: [
      { name: "Fresh Orange Juice", priceCents: 600 },
      { name: "Sparkling Water", priceCents: 400 },
    ],
  },
];

export const SAMPLE_TABLES: { label: string; section: string }[] = [
  ...Array.from({ length: 8 }, (_, i) => ({
    label: String(i + 1),
    section: "Indoor",
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    label: String(i + 9),
    section: "Courtyard",
  })),
];
