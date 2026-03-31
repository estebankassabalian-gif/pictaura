import Stripe from "stripe";
import { env } from "@/config/env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

/**
 * Returns the Stripe Price ID for a given pack.
 * Throws if the env var is not set.
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
