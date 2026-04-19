import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { addCreditsFromPurchase } from "@/services/credits";
import { PLANS, type PlanId, type BillingInterval } from "@/config/plans";
import {
  sendSubscriptionCancellationScheduledEmail,
  sendSubscriptionEndedEmail,
} from "@/lib/email";

function resolvePlan(metadataPlanId?: string | null) {
  if (!metadataPlanId) return PLANS[1]; // Par défaut : Pro (tier du milieu)
  const plan = PLANS.find((p) => p.id === (metadataPlanId as PlanId));
  return plan ?? PLANS[1];
}

function resolveInterval(metadataInterval?: string | null): BillingInterval {
  return metadataInterval === "year" ? "year" : "month";
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe webhook signature invalide:", err);
    return NextResponse.json(
      { error: "Signature webhook invalide" },
      { status: 400 }
    );
  }

  switch (event.type) {
    // ── Nouvel abonnement OU pack one-shot via Checkout ──────────────
    case "checkout.session.completed": {
      const session = event.data.object as unknown as {
        id: string;
        metadata: Record<string, string | undefined>;
        subscription: string | null;
        customer: string;
        mode: string;
        payment_intent: string | null;
      };

      console.log(`📩 checkout.session.completed — mode: ${session.mode}, customer: ${session.customer}, metadata:`, session.metadata);

      // ─── Mode "payment" : pack one-shot de crédits ───────────────
      if (session.mode === "payment") {
        if (session.metadata?.kind !== "pack") break;

        const packCredits = parseInt(session.metadata.packCredits ?? "0", 10);
        if (!packCredits || packCredits <= 0) {
          console.error("❌ Pack one-shot sans crédits valides:", session.metadata);
          break;
        }

        // Résoudre le user (customer ou metadata)
        let userId: string | undefined;
        if (session.customer) {
          const dbUser = await prisma.user.findFirst({
            where: { stripeCustomerId: session.customer },
            select: { id: true },
          });
          userId = dbUser?.id;
        }
        if (!userId && session.metadata?.userId) {
          const dbUser = await prisma.user.findUnique({
            where: { id: session.metadata.userId },
            select: { id: true },
          });
          userId = dbUser?.id;
        }

        if (!userId) {
          console.error("❌ Pack one-shot — user non résolu:", session.metadata);
          break;
        }

        try {
          await addCreditsFromPurchase(
            userId,
            packCredits,
            `pack_${session.id}`,
            `Pack ${packCredits} crédits — achat unique`
          );
          console.log(`✅ Pack ${packCredits} crédits ajouté pour ${userId}`);
        } catch (err) {
          console.error("❌ Erreur crédit pack:", err);
        }
        break;
      }

      // ─── Mode "subscription" : nouvel abonnement ──────────────────
      if (session.mode !== "subscription") break;
      const planFromMeta = resolvePlan(session.metadata?.planId);
      const intervalFromMeta = resolveInterval(session.metadata?.interval);

      let userId: string | undefined;

      if (session.customer) {
        const dbUser = await prisma.user.findFirst({
          where: { stripeCustomerId: session.customer },
          select: { id: true },
        });
        userId = dbUser?.id;
      }

      if (!userId && session.metadata?.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: session.metadata.userId },
          select: { id: true },
        });
        if (dbUser) {
          userId = dbUser.id;
          await prisma.user.update({
            where: { id: userId },
            data: { stripeCustomerId: session.customer },
          });
          console.log(`🔗 stripeCustomerId ${session.customer} associé au user ${userId} via metadata fallback`);
        }
      }

      if (!userId) {
        console.error("❌ Impossible de résoudre l'utilisateur — customer:", session.customer, "metadata:", session.metadata);
        break;
      }

      if (!session.subscription) {
        console.error("❌ Session subscription sans subscription id:", session.id);
        break;
      }

      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      const periodEnd = new Date(subscription.current_period_end * 1000);

      await prisma.user.update({
        where: { id: userId },
        data: {
          isSubscribed: true,
          planId: planFromMeta.id,
          billingInterval: intervalFromMeta,
          stripeSubscriptionId: session.subscription,
          subscriptionEndsAt: periodEnd,
        },
      });

      try {
        await addCreditsFromPurchase(
          userId,
          planFromMeta.creditsPerMonth,
          `sub_initial_${session.subscription}`,
          `Abonnement ${planFromMeta.name} — ${planFromMeta.creditsPerMonth} crédits`
        );
        console.log(`✅ Abonnement ${planFromMeta.name} (${intervalFromMeta}) activé pour ${userId} — ${planFromMeta.creditsPerMonth} crédits`);
      } catch (err) {
        console.error("❌ Erreur ajout crédits abonnement:", err);
      }
      break;
    }

    // ── Renouvellement mensuel/annuel (facture payée) ────────────
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as unknown as {
        id: string;
        subscription: string | null;
        customer: string;
        billing_reason: string;
      };

      if (invoice.billing_reason === "subscription_create") break;
      if (!invoice.subscription) break;

      const dbUser = invoice.customer
        ? await prisma.user.findFirst({ where: { stripeCustomerId: invoice.customer }, select: { id: true } })
        : null;
      const userId = dbUser?.id;

      if (!userId) {
        console.error("Impossible de résoudre l'utilisateur pour le renouvellement:", invoice.customer);
        break;
      }

      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const periodEnd = new Date(subscription.current_period_end * 1000);

      const subMeta = subscription.metadata as { planId?: string; interval?: string } | undefined;
      const planRenewal = resolvePlan(subMeta?.planId);
      const intervalRenewal = resolveInterval(subMeta?.interval);

      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionEndsAt: periodEnd,
          planId: planRenewal.id,
          billingInterval: intervalRenewal,
        },
      });

      try {
        await addCreditsFromPurchase(
          userId,
          planRenewal.creditsPerMonth,
          `invoice_${invoice.id}`,
          `Renouvellement ${planRenewal.name} — ${planRenewal.creditsPerMonth} crédits`
        );
        console.log(`✅ Renouvellement ${planRenewal.name} pour ${userId} — ${planRenewal.creditsPerMonth} crédits`);
      } catch (err) {
        console.error("Erreur ajout crédits renouvellement:", err);
      }
      break;
    }

    // ── Résiliation planifiée ────────────────────────────────────
    case "customer.subscription.updated": {
      const subscription = event.data.object as unknown as {
        id: string;
        customer: string;
        cancel_at_period_end: boolean;
        current_period_end: number;
      };

      if (!subscription.cancel_at_period_end) break;

      const dbUser = subscription.customer
        ? await prisma.user.findFirst({
            where: { stripeCustomerId: subscription.customer },
            select: { id: true, email: true, name: true },
          })
        : null;
      if (!dbUser) break;

      const endsAt = new Date(subscription.current_period_end * 1000);
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { subscriptionEndsAt: endsAt },
      });

      if (dbUser.email) {
        sendSubscriptionCancellationScheduledEmail({
          to: dbUser.email,
          userName: dbUser.name ?? dbUser.email,
          endsAt,
        }).catch((err) => console.error("Email résiliation planifiée:", err));
      }
      console.log(`📅 Résiliation planifiée pour ${dbUser.id} — fin le ${endsAt.toISOString()}`);
      break;
    }

    // ── Abonnement terminé ───────────────────────────────────────
    case "customer.subscription.deleted": {
      const subscription = event.data.object as unknown as {
        id: string;
        customer: string;
      };

      const dbUser = subscription.customer
        ? await prisma.user.findFirst({
            where: { stripeCustomerId: subscription.customer },
            select: { id: true, email: true, name: true, credits: true },
          })
        : null;

      if (!dbUser) {
        console.error("Impossible de résoudre l'utilisateur pour l'annulation:", subscription.customer);
        break;
      }

      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          isSubscribed: false,
          planId: null,
          billingInterval: null,
          stripeSubscriptionId: null,
        },
      });

      if (dbUser.email) {
        sendSubscriptionEndedEmail({
          to: dbUser.email,
          userName: dbUser.name ?? dbUser.email,
          remainingCredits: dbUser.credits,
        }).catch((err) => console.error("Email fin d'abonnement:", err));
      }
      console.log(`⚠️ Abonnement terminé pour ${dbUser.id}`);
      break;
    }

    case "payment_intent.payment_failed": {
      console.log("Paiement échoué:", event.data.object);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
