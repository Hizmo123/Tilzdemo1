// Language list for onboarding's location step (and its Settings -> Venue
// setup mirror). This only records the venue's preferred language on the
// Restaurant row for now — it doesn't yet translate the customer ordering
// page's UI strings. Menu item names/descriptions are always whatever the
// venue typed, in whatever language they typed them in, regardless of this
// setting. Real UI translation is a separate, larger piece of work.
export const LANGUAGES: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "zh", name: "Chinese (中文)" },
  { code: "vi", name: "Vietnamese (Tiếng Việt)" },
  { code: "ar", name: "Arabic (العربية)" },
  { code: "es", name: "Spanish (Español)" },
  { code: "it", name: "Italian (Italiano)" },
  { code: "ja", name: "Japanese (日本語)" },
  { code: "ko", name: "Korean (한국어)" },
  { code: "th", name: "Thai (ไทย)" },
  { code: "hi", name: "Hindi (हिन्दी)" },
];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as [string, ...string[]];
