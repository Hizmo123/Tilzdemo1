import type { Restaurant } from "@prisma/client";

// Every settings sub-page renders the same SettingsForm component (just a
// different `section`), and that component's save() call always submits the
// full settings payload regardless of which section is visible — so every
// sub-page needs this same complete `initial` shape. Centralised here so five
// separate pages can't drift out of sync with each other or with the fields
// SettingsForm actually reads.
export function buildSettingsInitial(restaurant: Restaurant) {
  return {
    name: restaurant.name,
    country: restaurant.country,
    language: restaurant.language,
    abn: restaurant.abn,
    timezone: restaurant.timezone,
    currency: restaurant.currency,
    brandColor: restaurant.brandColor,
    theme: restaurant.theme,
    themeMode: restaurant.themeMode,
    fontTheme: restaurant.fontTheme,
    cornerStyle: restaurant.cornerStyle,
    tagline: restaurant.tagline,
    menuLayout: restaurant.menuLayout,
    cardStyle: restaurant.cardStyle,
    typeScale: restaurant.typeScale,
    sectionHeaderStyle: restaurant.sectionHeaderStyle,
    buttonShape: restaurant.buttonShape,
    buttonFill: restaurant.buttonFill,
    bgTreatment: restaurant.bgTreatment,
    bgPatternKey: restaurant.bgPatternKey,
    bgOverlayStrength: restaurant.bgOverlayStrength,
    qrForegroundColor: restaurant.qrForegroundColor,
    qrBackgroundColor: restaurant.qrBackgroundColor,
    qrCornerStyle: restaurant.qrCornerStyle,
    qrEmbedLogo: restaurant.qrEmbedLogo,
    qrCardTemplate: restaurant.qrCardTemplate,
    instagramHandle: restaurant.instagramHandle,
    websiteUrl: restaurant.websiteUrl,
    logoUrl: restaurant.logoUrl,
    coverUrl: restaurant.coverUrl,
    bgImageUrl: restaurant.bgImageUrl,
    tipEnabled: restaurant.tipEnabled,
    tipPresets: restaurant.tipPresets,
    customerOrdering: restaurant.customerOrdering,
    customerPayment: restaurant.customerPayment,
    staffApproval: restaurant.staffApproval,
    paymentTiming: restaurant.paymentTiming,
    requirePaymentBeforeOrder: restaurant.requirePaymentBeforeOrder,
    kitchenChime: restaurant.kitchenChime,
    surchargeEnabled: restaurant.surchargeEnabled,
    surchargeBasisPoints: restaurant.surchargeBasisPoints,
    hours: restaurant.hours,
    slug: restaurant.slug,
    ownerPhone: restaurant.ownerPhone,
    abnVerifiedAt: restaurant.abnVerifiedAt?.toISOString() ?? null,
    abnVerifiedValue: restaurant.abnVerifiedValue,
    abnVerifiedName: restaurant.abnVerifiedName,
  };
}
