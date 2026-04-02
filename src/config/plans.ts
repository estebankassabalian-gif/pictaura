export const CREDIT_PACKS = [
  {
    id: "starter",
    name: "Pack Starter",
    credits: 20,
    priceEurCents: 500,
    priceDisplay: "5€",
    pricePerPhoto: "0,25€/photo",
    popular: false,
    stripePriceEnvKey: "STRIPE_PRICE_STARTER" as const,
  },
  {
    id: "pro",
    name: "Pack Pro",
    credits: 75,
    priceEurCents: 1500,
    priceDisplay: "15€",
    pricePerPhoto: "0,20€/photo",
    popular: true,
    stripePriceEnvKey: "STRIPE_PRICE_PRO" as const,
  },
  {
    id: "studio",
    name: "Pack Studio",
    credits: 200,
    priceEurCents: 3000,
    priceDisplay: "30€",
    pricePerPhoto: "0,15€/photo",
    popular: false,
    stripePriceEnvKey: "STRIPE_PRICE_STUDIO" as const,
  },
] as const;

// ─── Abonnements mensuels ────────────────────────────────────────────────────
// TODO : créer ces 3 produits dans Stripe Dashboard (type "recurring", interval "month")
// puis coller les price_xxx dans .env.local :
//   STRIPE_PRICE_SUB_ESSENTIAL=price_xxx
//   STRIPE_PRICE_SUB_PRO=price_xxx
//   STRIPE_PRICE_SUB_AGENCY=price_xxx
export const SUBSCRIPTION_PLANS = [
  {
    id: "essential",
    name: "Essentiel",
    creditsPerMonth: 100,
    priceEurCents: 2900,
    priceDisplay: "29€/mois",
    pricePerPhoto: "0,29€/photo",
    popular: false,
    stripePriceEnvKey: "STRIPE_PRICE_SUB_ESSENTIAL" as const,
    features: ["100 photos/mois", "Sans watermark", "Tous les outils", "CSV SEO inclus"],
  },
  {
    id: "pro_sub",
    name: "Pro",
    creditsPerMonth: 300,
    priceEurCents: 4900,
    priceDisplay: "49€/mois",
    pricePerPhoto: "0,16€/photo",
    popular: true,
    stripePriceEnvKey: "STRIPE_PRICE_SUB_PRO" as const,
    features: ["300 photos/mois", "Sans watermark", "Tous les outils", "EXIF SEO gravé", "Support prioritaire"],
  },
  {
    id: "agency",
    name: "Agence",
    creditsPerMonth: 1000,
    priceEurCents: 9900,
    priceDisplay: "99€/mois",
    pricePerPhoto: "0,10€/photo",
    popular: false,
    stripePriceEnvKey: "STRIPE_PRICE_SUB_AGENCY" as const,
    features: ["1000 photos/mois", "Sans watermark", "Tous les outils", "Factures TVA auto", "Support dédié"],
  },
] as const;

export const FREE_SIGNUP_CREDITS = 5;

export const INPAINTING_CREDITS_COST = 1; // 1 crédit/retouche — débité uniquement à la validation
export const INSTAGRAM_HD_CREDITS_COST = 2; // Toggle HD = +1 crédit sur base
export const MAX_PHOTOS_PER_BATCH = 5;
export const MAX_FILE_SIZE_MB = 20;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const PRESET_LABELS = {
  AIRBNB: "Immobilier",          // conservé pour compat données existantes
  IMMOBILIER: "Immobilier",      // preset B2B principal — agences immo
  INSTAGRAM: "Instagram / Réseaux",
  VINTED: "Vinted / Marketplace",
  SHOPIFY: "Shopify / E-commerce",
} as const;
