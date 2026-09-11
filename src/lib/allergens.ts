// The allergens Australian venues commonly declare. Owners tick these per menu
// item; they show to customers on the ordering page.
export const ALLERGEN_OPTIONS = [
  "Gluten",
  "Wheat",
  "Milk",
  "Egg",
  "Peanut",
  "Tree nuts",
  "Soy",
  "Sesame",
  "Fish",
  "Crustacean",
  "Mollusc",
  "Lupin",
  "Sulphites",
] as const;

export const ALLERGEN_SET = new Set<string>(ALLERGEN_OPTIONS);
