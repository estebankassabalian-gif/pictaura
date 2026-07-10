import { z } from "zod";

// Helper: treat empty strings as undefined (common with .env files)
const optionalStr = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : v),
  z.string().min(1).optional()
);

const optionalPrefixed = (prefix: string) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().startsWith(prefix).optional()
  );

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // NextAuth
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),

  // Google OAuth (optionnel pour MVP)
  GOOGLE_CLIENT_ID: optionalStr,
  GOOGLE_CLIENT_SECRET: optionalStr,

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_DOMAIN: optionalStr,

  // Stripe — 3 tiers (Starter / Pro / Business), chacun avec un prix mensuel et annuel.
  // + 1 pack one-shot (30 crédits, paiement unique).
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PRICE_STARTER_MONTHLY: optionalPrefixed("price_"),
  STRIPE_PRICE_STARTER_ANNUAL: optionalPrefixed("price_"),
  STRIPE_PRICE_PRO_MONTHLY: optionalPrefixed("price_"),
  STRIPE_PRICE_PRO_ANNUAL: optionalPrefixed("price_"),
  STRIPE_PRICE_BUSINESS_MONTHLY: optionalPrefixed("price_"),
  STRIPE_PRICE_BUSINESS_ANNUAL: optionalPrefixed("price_"),
  STRIPE_PRICE_ONESHOT_PACK30: optionalPrefixed("price_"),

  // Replicate (legacy — plus utilisé, gardé optionnel pour rétro-compat)
  REPLICATE_API_TOKEN: optionalStr,

  // Google AI (Gemini) — requis pour l'analyse et la retouche photo
  GOOGLE_AI_KEY: z.string().min(1),

  // fal.ai — provider image alternatif (FLUX Kontext). Optionnel : sans clé,
  // le provider fal est simplement inéligible et gemini reste utilisé.
  FAL_KEY: optionalStr,
  IMAGE_PROVIDER_PRIMARY: optionalStr, // 'gemini' (défaut) | 'fal'
  IMAGE_PROVIDER_FALLBACK: optionalStr, // secours explicite
  IMAGE_PROVIDER_OVERRIDE: optionalStr, // kill-switch : épingle un provider

  // Resend
  RESEND_API_KEY: z.string().startsWith("re_"),
  RESEND_FROM_EMAIL: z.string().email(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
  ADMIN_EMAIL: z.string().email(),

  // Sentry (optionnel — monitoring d'erreurs)
  SENTRY_DSN: optionalStr,
  NEXT_PUBLIC_SENTRY_DSN: optionalStr,
});

// Validate at startup — throws clear error if any var is missing
const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  console.error("❌ Variables d'environnement invalides ou manquantes:");
  console.error(_parsed.error.flatten().fieldErrors);
  // During Docker build (next build): warn only, env vars injected at runtime by Coolify.
  // In production runtime: crash immediately to prevent silent failures.
  if (process.env.NODE_ENV === "production" && !process.env.NEXT_PHASE) {
    throw new Error("Variables d'environnement manquantes en production. Vérifiez la configuration Coolify.");
  }
}

export const env = (_parsed.success ? _parsed.data : process.env) as z.infer<
  typeof envSchema
>;
