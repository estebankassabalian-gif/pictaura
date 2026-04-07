import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { addCreditsFromPurchase } from "@/services/credits";
import { PRO_PLAN } from "@/config/plans";

export const config = { api: { bodyParser: false } };

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
    // ── Nouvel abonnement créé via Checkout ──────────────────
    case "checkout.session.completed": {
      const session = event.data.object as unknown as {
        metadata: { userId: string; planId: string };
        subscription: string;
        customer: string;
        mode: string;
      };

      if (session.mode !== "subscription") break;

      const dbUser = session.customer
        ? await prisma.user.findFirst({ where: { stripeCustomerId: session.customer }, select: { id: true } })
        : null;
      const userId = dbUser?.id;

      if (!userId) {
        console.error("Impossible de résoudre l'utilisateur pour le customer:", session.customer);
        break;
      }

      // Récupérer les détails de la subscription pour la date de fin
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      const periodEnd = new Date(subscription.current_period_end * 1000);

      // Activer l'abonnement + créditer les photos mensuelles
      await prisma.user.update({
        where: { id: userId },
        data: {
          isSubscribed: true,
          stripeSubscriptionId: session.subscription,
          subscriptionEndsAt: periodEnd,
        },
      });

      try {
        await addCreditsFromPurchase(
          userId,
          PRO_PLAN.creditsPerMonth,
          `sub_initial_${session.subscription}`,
          `Abonnement Pro — ${PRO_PLAN.creditsPerMonth} crédits`
        );
        console.log(`✅ Abonnement Pro activé pour ${userId} — ${PRO_PLAN.creditsPerMonth} crédits ajoutés`);
      } catch (err) {
        console.error("Erreur ajout crédits abonnement:", err);
      }
      break;
    }

    // ── Renouvellement mensuel (facture payée) ───────────────
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as unknown as {
        subscription: string;
        customer: string;
        billing_reason: string;
      };

      // Ignorer la première facture (déjà gérée par checkout.session.completed)
      if (invoice.billing_reason === "subscription_create") break;

      const dbUser = invoice.customer
        ? await prisma.user.findFirst({ where: { stripeCustomerId: invoice.customer }, select: { id: true } })
        : null;
      const userId = dbUser?.id;

      if (!userId) {
        console.error("Impossible de résoudre l'utilisateur pour le renouvellement:", invoice.customer);
        break;
      }

      // Récupérer la nouvelle période
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const periodEnd = new Date(subscription.current_period_end * 1000);

      await prisma.user.update({
        where: { id: userId },
        data: { subscriptionEndsAt: periodEnd },
      });

      try {
        await addCreditsFromPurchase(
          userId,
          PRO_PLAN.creditsPerMonth,
          `sub_renew_${invoice.subscription}_${Date.now()}`,
          `Renouvellement Pro — ${PRO_PLAN.creditsPerMonth} crédits`
        );
        console.log(`✅ Renouvellement Pro pour ${userId} — ${PRO_PLAN.creditsPerMonth} crédits ajoutés`);
      } catch (err) {
        console.error("Erreur ajout crédits renouvellement:", err);
      }
      break;
    }

    // ── Abonnement annulé ────────────────────────────────────
    case "customer.subscription.deleted": {
      const subscription = event.data.object as unknown as {
        id: string;
        customer: string;
      };

      const dbUser = subscription.customer
        ? await prisma.user.findFirst({ where: { stripeCustomerId: subscription.customer }, select: { id: true } })
        : null;
      const userId = dbUser?.id;

      if (!userId) {
        console.error("Impossible de résoudre l'utilisateur pour l'annulation:", subscription.customer);
        break;
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          isSubscribed: false,
          stripeSubscriptionId: null,
        },
      });
      console.log(`⚠️ Abonnement annulé pour ${userId}`);
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
