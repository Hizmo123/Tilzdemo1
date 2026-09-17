// Plain, shared option lists + presets for the onboarding wizard and the
// Settings -> Venue setup page. Deliberately NOT in an actions.ts file — a
// "use server" module may only export async functions, so exporting arrays
// from one turns them into opaque server references at runtime (see the note
// in dashboard/settings/constants.ts). Both the wizard and the settings page
// import from here so the two never drift apart.

export type IconKey =
  | "cafe"
  | "restaurant"
  | "bar"
  | "bakery"
  | "truck"
  | "bolt"
  | "star"
  | "building"
  | "grid"
  | "droplet"
  | "dots"
  | "users"
  | "qr"
  | "storefront"
  | "bag"
  | "shuffle"
  | "book"
  | "cart"
  | "card"
  | "sliders";

export const VENUE_TYPES: { value: string; label: string; icon: IconKey }[] = [
  { value: "cafe", label: "Café", icon: "cafe" },
  { value: "restaurant", label: "Restaurant", icon: "restaurant" },
  { value: "bar", label: "Bar / pub", icon: "bar" },
  { value: "bakery", label: "Bakery", icon: "bakery" },
  { value: "food_truck", label: "Food truck", icon: "truck" },
  { value: "fast_casual", label: "Fast casual", icon: "bolt" },
  { value: "fine_dining", label: "Fine dining", icon: "star" },
  { value: "hotel_venue", label: "Hotel / venue restaurant", icon: "building" },
  { value: "food_court", label: "Food court / food hall", icon: "grid" },
  { value: "dessert_juice_bar", label: "Dessert & juice bar", icon: "droplet" },
  { value: "other", label: "Something else", icon: "dots" },
];

export const SERVICE_STYLES: {
  value: string;
  label: string;
  desc: string;
  icon: IconKey;
}[] = [
  {
    value: "table_service",
    label: "Table service",
    desc: "Staff take orders at the table.",
    icon: "users",
  },
  {
    value: "counter",
    label: "Order at counter",
    desc: "Guests order and pay at the counter.",
    icon: "storefront",
  },
  {
    value: "mixed",
    label: "A mix",
    desc: "Different tables or times use different styles.",
    icon: "shuffle",
  },
];

// Real, coherent toggle combinations. Custom (handled separately by the
// caller) starts from order_and_pay's values, then the owner adjusts freely.
export type ExperienceSettings = {
  customerOrdering: boolean;
  customerPayment: boolean;
  paymentTiming: "before" | "after";
  staffApproval: boolean;
};

export const EXPERIENCE_MODES: Record<
  string,
  { label: string; blurb: string; icon: IconKey; settings: ExperienceSettings }
> = {
  digital_menu: {
    label: "Digital menu",
    blurb: "QR menu only — no ordering, no payment from the phone.",
    icon: "book",
    settings: {
      customerOrdering: false,
      customerPayment: false,
      paymentTiming: "after",
      staffApproval: false,
    },
  },
  order_and_pay: {
    label: "Order & pay",
    blurb: "Full self-service: order, live bill, split, and pay from the phone.",
    icon: "cart",
    settings: {
      customerOrdering: true,
      customerPayment: true,
      paymentTiming: "after",
      staffApproval: false,
    },
  },
  payment_only: {
    label: "Payment only",
    blurb: "Staff take orders; guests scan to view and pay their bill.",
    icon: "card",
    settings: {
      customerOrdering: false,
      customerPayment: true,
      paymentTiming: "after",
      staffApproval: false,
    },
  },
};
export type ExperienceModeKey = keyof typeof EXPERIENCE_MODES | "custom";
export const DEFAULT_CUSTOM_SETTINGS: ExperienceSettings =
  EXPERIENCE_MODES.order_and_pay.settings;

// Plain-English summary of what a settings combination actually switches on —
// shown under each preset card so nothing about it is hidden.
export function summarizeExperience(s: ExperienceSettings): string {
  const parts: string[] = [];
  parts.push(s.customerOrdering ? "Guests order from their phone" : "Staff take orders");
  parts.push(
    s.customerPayment
      ? s.paymentTiming === "before"
        ? "pay before it's sent"
        : "pay from their phone"
      : "pay at the counter",
  );
  if (s.staffApproval) parts.push("staff approve first");
  return parts.join(" · ");
}

export const SPLIT_METHOD_VALUES = ["full", "equal", "items", "custom"] as const;
export type SplitMethod = (typeof SPLIT_METHOD_VALUES)[number];
export const SPLIT_METHODS: { value: SplitMethod; label: string; desc: string }[] = [
  { value: "full", label: "Pay in full", desc: "One person pays the whole bill." },
  {
    value: "equal",
    label: "Split equally",
    desc: "Divide the total across however many people.",
  },
  {
    value: "items",
    label: "Pay for your own items",
    desc: "Each person pays for just what they ordered.",
  },
  { value: "custom", label: "Custom amount", desc: "Pay any amount toward the bill." },
];

// The wizard's full answer shape. Deliberately plain data only (no Dates, no
// Maps) so it round-trips through OnboardingDraft.answers (a Json column) and
// through completeOnboarding's zod schema unchanged.
export type OnboardingAnswers = {
  country: string;
  language: string;
  restaurantName: string;
  venueType: string;
  serviceStyle: string | null;
  experienceMode: ExperienceModeKey;
  customerOrdering: boolean;
  customerPayment: boolean;
  paymentTiming: "before" | "after";
  staffApproval: boolean;
  tableCount: number;
  hoursMode: "same" | "weekday_weekend" | "later";
  hoursWeekday: { open: string; close: string };
  hoursWeekend: { open: string; close: string };
  menuPeriods: boolean;
  menuStations: boolean;
  sampleMenu: boolean;
  splitMethods: SplitMethod[];
  tipEnabled: boolean;
  tipPresets: number[];
  theme: string;
  themeMode: "light" | "dark";
  fontTheme: string;
  cornerStyle: string;
  brandColor: string;
  tagline: string;
  logoUrl: string | null;
  abn: string;
  currency: string;
  timezone: string;
  kitchenChime: boolean;
  orderReadySmsEnabled: boolean;
  // "square" | "none" | null (unanswered). Square is the only POS asked
  // about — it's the only one on the roadmap (see PaymentConnection /
  // Delivery 1b); asking about brands with no integration plan would only
  // collect hope. posProviderOther is legacy from the old multi-brand
  // picker and is no longer written, kept only so existing rows still parse.
  posProvider: string | null;
  posProviderOther: string;
  // True only when posProvider === "square" and the owner opted in to a
  // future connection. Captured now, acted on once Square OAuth (Delivery 1b)
  // actually lands — see Restaurant.squareConnectInterest.
  squareConnectInterest: boolean;
};

// What actually gets persisted mid-wizard — the answers so far plus which
// step they were on, so a refresh resumes in the same place, not just with
// the same data.
export type OnboardingDraftPayload = {
  step: number;
  answers: Partial<OnboardingAnswers>;
};

export function defaultOnboardingAnswers(): OnboardingAnswers {
  return {
    country: "AU",
    language: "en",
    restaurantName: "",
    venueType: "cafe",
    serviceStyle: null,
    experienceMode: "order_and_pay",
    ...EXPERIENCE_MODES.order_and_pay.settings,
    tableCount: 10,
    hoursMode: "same",
    hoursWeekday: { open: "09:00", close: "17:00" },
    hoursWeekend: { open: "09:00", close: "17:00" },
    menuPeriods: false,
    menuStations: false,
    sampleMenu: true,
    splitMethods: [...SPLIT_METHOD_VALUES],
    tipEnabled: false,
    tipPresets: [5, 10, 15],
    theme: "warm",
    themeMode: "light",
    fontTheme: "classic",
    cornerStyle: "soft",
    brandColor: "",
    tagline: "",
    logoUrl: null,
    abn: "",
    currency: "AUD",
    timezone: "Australia/Sydney",
    kitchenChime: true,
    orderReadySmsEnabled: true,
    posProvider: null,
    posProviderOther: "",
    squareConnectInterest: false,
  };
}
