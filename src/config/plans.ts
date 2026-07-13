// ─── Pictaura — 3 plans tier-based + pack one-shot ────────────────────────
// Chaque plan a 2 prix Stripe : mensuel + annuel (-20% sur l'annuel).
// Le pack one-shot est un paiement unique (30 crédits, 9,90€).
//
// Clés Stripe à placer dans .env :
//   STRIPE_PRICE_STARTER_MONTHLY=price_xxx
//   STRIPE_PRICE_STARTER_ANNUAL=price_xxx
//   STRIPE_PRICE_PRO_MONTHLY=price_xxx
//   STRIPE_PRICE_PRO_ANNUAL=price_xxx
//   STRIPE_PRICE_BUSINESS_MONTHLY=price_xxx
//   STRIPE_PRICE_BUSINESS_ANNUAL=price_xxx
//   STRIPE_PRICE_ONESHOT_PACK30=price_xxx

export type PlanId = "starter" | "pro" | "business";
export type BillingInterval = "month" | "year";

export type StripePriceEnvKey =
  | "STRIPE_PRICE_STARTER_MONTHLY"
  | "STRIPE_PRICE_STARTER_ANNUAL"
  | "STRIPE_PRICE_PRO_MONTHLY"
  | "STRIPE_PRICE_PRO_ANNUAL"
  | "STRIPE_PRICE_BUSINESS_MONTHLY"
  | "STRIPE_PRICE_BUSINESS_ANNUAL"
  | "STRIPE_PRICE_ONESHOT_PACK30";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  creditsPerMonth: number;
  monthlyPriceEurCents: number;
  annualPriceEurCents: number;
  stripePriceEnvKeyMonthly: StripePriceEnvKey;
  stripePriceEnvKeyAnnual: StripePriceEnvKey;
  accentColor: string;
  highlighted?: boolean;
  features: readonly string[];
}

export const PLANS: readonly Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Pour lancer vos annonces",
    creditsPerMonth: 80,
    monthlyPriceEurCents: 1490,
    annualPriceEurCents: 14300,
    stripePriceEnvKeyMonthly: "STRIPE_PRICE_STARTER_MONTHLY",
    stripePriceEnvKeyAnnual: "STRIPE_PRICE_STARTER_ANNUAL",
    accentColor: "#F87005",
    features: [
      "80 retouches IA par mois",
      "Tous les presets : Immobilier, Réseaux sociaux, E-commerce",
      "Tous les formats plateformes (Vinted, Shopify, Instagram, Stories, Reels…)",
      "Métadonnées SEO + EXIF automatiques",
      "Hashtags FR + EN générés",
      "Jusqu'à 50 Mo par photo",
      "Support par email sous 48h",
      "Sans engagement, résiliable en un clic",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Pour les agences actives",
    creditsPerMonth: 250,
    monthlyPriceEurCents: 3990,
    annualPriceEurCents: 38300,
    stripePriceEnvKeyMonthly: "STRIPE_PRICE_PRO_MONTHLY",
    stripePriceEnvKeyAnnual: "STRIPE_PRICE_PRO_ANNUAL",
    accentColor: "#E1306C",
    highlighted: true,
    features: [
      "250 retouches IA par mois",
      "Tout Starter inclus",
      "Scoring IA de vos photos (note /10 + recommandations)",
      "JSON-LD schema.org pour le référencement",
      "Support prioritaire sous 24h",
      "Accès aux nouveautés en avant-première",
    ],
  },
  {
    id: "business",
    name: "Business",
    tagline: "Pour les gros volumes",
    creditsPerMonth: 600,
    monthlyPriceEurCents: 8990,
    annualPriceEurCents: 86300,
    stripePriceEnvKeyMonthly: "STRIPE_PRICE_BUSINESS_MONTHLY",
    stripePriceEnvKeyAnnual: "STRIPE_PRICE_BUSINESS_ANNUAL",
    accentColor: "#09B884",
    features: [
      "600 retouches IA par mois",
      "Tout Pro inclus",
      "Support dédié par email",
      "Facturation entreprise (TVA)",
      "Engagement qualité : remboursement crédit si résultat non satisfaisant",
    ],
  },
] as const;

export interface OneShotPack {
  id: string;
  name: string;
  tagline: string;
  credits: number;
  priceEurCents: number;
  stripePriceEnvKey: StripePriceEnvKey;
}

export const ONESHOT_PACK: OneShotPack = {
  id: "pack30",
  name: "Pack 30 crédits",
  tagline: "Testez sans abonnement",
  credits: 30,
  priceEurCents: 990,
  stripePriceEnvKey: "STRIPE_PRICE_ONESHOT_PACK30",
};

export function getPlan(id: PlanId): Plan {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Plan inconnu : ${id}`);
  return plan;
}

export function getStripePriceEnvKey(
  planId: PlanId,
  interval: BillingInterval
): StripePriceEnvKey {
  const plan = getPlan(planId);
  return interval === "year"
    ? plan.stripePriceEnvKeyAnnual
    : plan.stripePriceEnvKeyMonthly;
}

export function getPriceEurCents(plan: Plan, interval: BillingInterval): number {
  return interval === "year" ? plan.annualPriceEurCents : plan.monthlyPriceEurCents;
}

export function formatEur(cents: number): string {
  const euros = cents / 100;
  if (Number.isInteger(euros)) return `${euros}€`;
  return `${euros.toFixed(2).replace(".", ",")}€`;
}

export function formatPriceDisplay(plan: Plan, interval: BillingInterval): string {
  const cents = getPriceEurCents(plan, interval);
  const suffix = interval === "year" ? "/an" : "/mois";
  return `${formatEur(cents)}${suffix}`;
}

// Backward-compat : l'ancien PRO_PLAN pointait vers le seul plan existant.
// Il pointe désormais vers le nouveau plan "pro" (le plus proche de l'ancien 49,90€/500).
export const PRO_PLAN = {
  id: "pro",
  name: "Pro",
  creditsPerMonth: PLANS[1].creditsPerMonth,
  priceEurCents: PLANS[1].monthlyPriceEurCents,
  priceDisplay: formatPriceDisplay(PLANS[1], "month"),
} as const;

export const FREE_SIGNUP_CREDITS = 5;

export const INPAINTING_CREDITS_COST = 1;
export const INSTAGRAM_HD_CREDITS_COST = 2;
export const REEL_CREDITS_COST = 3;
export const MAX_PHOTOS_PER_BATCH = 30;
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
