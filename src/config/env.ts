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

  // Stripe — 3 abonnements (Immobilier / Réseaux / E-commerce), tous à 49,90€/mois.
  // STRIPE_PRICE_PRO reste pour la rétro-compat tant que les 3 prix ne sont pas créés.
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PRICE_PRO: optionalPrefixed("price_"),
  STRIPE_PRICE_IMMOBILIER: optionalPrefixed("price_"),
  STRIPE_PRICE_SOCIAL: optionalPrefixed("price_"),
  STRIPE_PRICE_ECOMMERCE: optionalPrefixed("price_"),

  // Replicate (legacy — plus utilisé, gardé optionnel pour rétro-compat)
  REPLICATE_API_TOKEN: optionalStr,

  // OpenAI (legacy — migré vers Gemini, gardé pour rétro-compat si présent)
  OPENAI_API_KEY: optionalPrefixed("sk-"),

  // Google AI (Gemini) — requis pour l'analyse et la retouche photo
  GOOGLE_AI_KEY: z.string().min(1),

  // Resend
  RESEND_API_KEY: z.string().startsWith("re_"),
  RESEND_FROM_EMAIL: z.string().email(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
  ADMIN_EMAIL: z.string().email(),
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
