import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { addCreditsFromPurchase } from "@/services/credits";
import { CREDIT_PACKS } from "@/config/plans";

// Important: désactiver le body parser pour avoir le raw body
// nécessaire pour la vérification de signature Stripe
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

  // ── Traiter les événements ────────────────────────────────

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as unknown as {
        metadata: { userId: string; packId: string; credits: string };
        payment_intent: string;
        customer: string;
        customer_details?: { email?: string };
      };

      const { packId, credits } = session.metadata ?? {};
      const paymentIntentId = String(session.payment_intent);
      const creditAmount = parseInt(credits, 10);

      if (!credits || isNaN(creditAmount)) {
        console.error("Metadata manquante dans checkout.session.completed");
        break;
      }

      // Résoudre l'userId UNIQUEMENT via le stripeCustomerId stocké en BDD (sécurisé)
      // On ne fait PAS de fallback vers metadata.userId (manipulable côté client)
      const dbUser = session.customer
        ? await prisma.user.findFirst({ where: { stripeCustomerId: session.customer }, select: { id: true } })
        : null;
      const userId = dbUser?.id;

      if (!userId) {
        console.error("Impossible de résoudre l'utilisateur pour le customer:", session.customer);
        break;
      }

      const pack = CREDIT_PACKS.find((p) => p.id === packId);

      try {
        await addCreditsFromPurchase(
          userId,
          creditAmount,
          paymentIntentId,
          `Achat ${pack?.name ?? packId} — ${creditAmount} crédits`
        );
        console.log(`✅ ${creditAmount} crédits ajoutés à l'utilisateur ${userId}`);
      } catch (err) {
        console.error("Erreur ajout crédits:", err);
        // Retourner 200 quand même pour éviter que Stripe retente indéfiniment
        // L'idempotence dans addCreditsFromPurchase gère les doublons
      }
      break;
    }

    case "payment_intent.payment_failed": {
      // Log uniquement — le user n'est pas débité (checkout n'a pas complété)
      console.log("Paiement échoué:", event.data.object);
      break;
    }

    default:
      // Ignorer les autres événements
      break;
  }

  return NextResponse.json({ received: true });
}
