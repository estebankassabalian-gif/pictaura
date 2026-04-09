// ─── Plan unique Pro ─────────────────────────────────────────────────────────
// Créer ce produit dans Stripe Dashboard (type "recurring", interval "month")
// puis coller le price_xxx dans .env :
//   STRIPE_PRICE_PRO=price_xxx
export const PRO_PLAN = {
  id: "pro",
  name: "Pro",
  creditsPerMonth: 200,
  priceEurCents: 2900,
  priceDisplay: "29€/mois",
  pricePerPhoto: "0,15€",
  stripePriceEnvKey: "STRIPE_PRICE_PRO" as const,
  features: [
    "200 photos/mois",
    "Tous les outils de retouche",
    "Métadonnées SEO (EXIF)",
    "Sans watermark",
    "Retouche IA illimitée",
    "Support prioritaire",
    "Résiliable à tout moment",
  ],
} as const;

export const FREE_SIGNUP_CREDITS = 5;

export const INPAINTING_CREDITS_COST = 1;
export const INSTAGRAM_HD_CREDITS_COST = 2;
export const REEL_CREDITS_COST = 3;
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
  AIRBNB: "Immobilier",
  IMMOBILIER: "Immobilier",
  INSTAGRAM: "Instagram / Réseaux",
  VINTED: "Vinted / Marketplace",
  SHOPIFY: "Shopify / E-commerce",
} as const;
