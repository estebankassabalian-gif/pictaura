// Re-export the webhook handler at /api/stripe/webhook
// to match the URL configured in Stripe Dashboard.
// The actual logic lives in /api/webhooks/stripe/route.ts.
export { POST } from "@/app/api/webhooks/stripe/route";
