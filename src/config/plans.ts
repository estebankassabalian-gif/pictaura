// ─── 3 Plans Pictaura — Immobilier / Réseaux / E-commerce ─────────────────
// Chaque plan = 49,90 €/mois, 300 retouches/mois.
// Créer 3 produits Stripe (type recurring, interval month), puis coller les
// price_xxx dans .env :
//   STRIPE_PRICE_IMMOBILIER=price_xxx
//   STRIPE_PRICE_SOCIAL=price_xxx
//   STRIPE_PRICE_ECOMMERCE=price_xxx

export type PlanId = "immobilier" | "social" | "ecommerce";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  creditsPerMonth: number;
  priceEurCents: number;
  priceDisplay: string;
  stripePriceEnvKey: "STRIPE_PRICE_IMMOBILIER" | "STRIPE_PRICE_SOCIAL" | "STRIPE_PRICE_ECOMMERCE";
  preset: "IMMOBILIER" | "INSTAGRAM" | "SHOPIFY";
  accentColor: string;
  features: readonly string[];
}

export const PLANS: readonly Plan[] = [
  {
    id: "immobilier",
    name: "Immobilier",
    tagline: "Annonces qui se vendent plus vite",
    creditsPerMonth: 300,
    priceEurCents: 4990,
    priceDisplay: "49,90€/mois",
    stripePriceEnvKey: "STRIPE_PRICE_IMMOBILIER",
    preset: "IMMOBILIER",
    accentColor: "#F87005",
    features: [
      "300 retouches par mois",
      "Preset Immobilier : HDR, verticalité, lumière pro",
      "Métadonnées SEO gravées dans l'image (EXIF + JSON-LD)",
      "Jusqu'à 50 Mo par photo — reflex pro compatible",
      "Support par email sous 24h",
      "Sans engagement, résiliable en un clic",
    ],
  },
  {
    id: "social",
    name: "Réseaux sociaux",
    tagline: "Contenu qui capte le regard",
    creditsPerMonth: 300,
    priceEurCents: 4990,
    priceDisplay: "49,90€/mois",
    stripePriceEnvKey: "STRIPE_PRICE_SOCIAL",
    preset: "INSTAGRAM",
    accentColor: "#E1306C",
    features: [
      "300 retouches par mois",
      "Formats prêts à publier : 1:1 feed, 4:5 portrait, 9:16 Stories",
      "20 hashtags FR + EN générés par photo",
      "Alt text et caption accrocheurs injectés en EXIF",
      "Jusqu'à 50 Mo par photo",
      "Support par email sous 24h",
      "Sans engagement, résiliable en un clic",
    ],
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    tagline: "Fiches produit prêtes à publier",
    creditsPerMonth: 300,
    priceEurCents: 4990,
    priceDisplay: "49,90€/mois",
    stripePriceEnvKey: "STRIPE_PRICE_ECOMMERCE",
    preset: "SHOPIFY",
    accentColor: "#09B884",
    features: [
      "300 retouches par mois",
      "Presets Shopify, Vinted, Etsy : fond blanc, cadrage produit",
      "JSON-LD Product schema.org pour le référencement",
      "Jusqu'à 50 Mo par photo",
      "Support par email sous 24h",
      "Sans engagement, résiliable en un clic",
    ],
  },
] as const;

export function getPlan(id: PlanId): Plan {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Plan inconnu : ${id}`);
  return plan;
}

// Backward-compat : certains endroits du back-end référencent encore PRO_PLAN.
export const PRO_PLAN = {
  id: "pro",
  name: "Pro",
  creditsPerMonth: PLANS[0].creditsPerMonth,
  priceEurCents: PLANS[0].priceEurCents,
  priceDisplay: PLANS[0].priceDisplay,
} as const;

export const FREE_SIGNUP_CREDITS = 5;

export const INPAINTING_CREDITS_COST = 1;
export const INSTAGRAM_HD_CREDITS_COST = 2;
export const REEL_CREDITS_COST = 3;
export const MAX_PHOTOS_PER_BATCH = 5;
export const MAX_FILE_SIZE_MB = 50;
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
  INSTAGRAM: "Réseaux sociaux",
  VINTED: "E-commerce",
  SHOPIFY: "E-commerce",
} as const;
