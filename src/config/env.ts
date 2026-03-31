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

  // Stripe — packs à l'unité
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: optionalPrefixed("whsec_"),
  STRIPE_PRICE_STARTER: z.string().startsWith("price_"),
  STRIPE_PRICE_PRO: z.string().startsWith("price_"),
  STRIPE_PRICE_STUDIO: z.string().startsWith("price_"),
  // Stripe — abonnements mensuels (optionnels tant que non créés dans Stripe)
  STRIPE_PRICE_SUB_ESSENTIAL: optionalPrefixed("price_"),
  STRIPE_PRICE_SUB_PRO: optionalPrefixed("price_"),
  STRIPE_PRICE_SUB_AGENCY: optionalPrefixed("price_"),

  // Replicate
  REPLICATE_API_TOKEN: z.string().min(1),

  // OpenAI
  OPENAI_API_KEY: z.string().startsWith("sk-"),

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
  // In production, hard fail. In dev, warn only.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Invalid environment variables");
  }
}

export const env = (_parsed.success ? _parsed.data : process.env) as z.infer<
  typeof envSchema
>;
