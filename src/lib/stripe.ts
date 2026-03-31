import Stripe from "stripe";
import { env } from "@/config/env";

let _stripe: Stripe | null = null;

/** Lazy-initialized Stripe client — avoids crash at build time when env vars are absent */
export function getStripe(): Stripe {
  if (!_stripe) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return _stripe;
}

/** @deprecated Use getStripe() instead — kept for compat */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  },
});

/**
 * Returns the Stripe Price ID for a given pack.
 */
export function getStripePriceId(
  packId: "starter" | "pro" | "studio"
): string {
  const map = {
    starter: env.STRIPE_PRICE_STARTER,
    pro: env.STRIPE_PRICE_PRO,
    studio: env.STRIPE_PRICE_STUDIO,
  };
  return map[packId];
}
