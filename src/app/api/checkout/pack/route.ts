import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { ONESHOT_PACK } from "@/config/plans";

/**
 * POST /api/checkout/pack — crée une session Stripe en mode="payment" pour
 * l'achat d'un pack one-shot (paiement unique, pas d'abonnement).
 * Les crédits sont ajoutés au compte via le webhook à la réception du paiement.
 */
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = session.user.id;

  const priceId = (env as Record<string, string | undefined>)[
    ONESHOT_PACK.stripePriceEnvKey
  ];
  if (!priceId) {
    return NextResponse.json(
      { error: `Configuration Stripe manquante : ${ONESHOT_PACK.stripePriceEnvKey}` },
      { status: 500 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  try {
    let stripeCustomerId = user?.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: session.user.name ?? undefined,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId },
      });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success&pack=${ONESHOT_PACK.id}`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/billing?payment=cancelled`,
      metadata: {
        userId,
        kind: "pack",
        packId: ONESHOT_PACK.id,
        packCredits: String(ONESHOT_PACK.credits),
      },
      payment_intent_data: {
        metadata: {
          userId,
          kind: "pack",
          packId: ONESHOT_PACK.id,
          packCredits: String(ONESHOT_PACK.credits),
        },
      },
      locale: "fr",
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Stripe checkout pack error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la session de paiement. Réessayez." },
      { status: 500 }
    );
  }
}
