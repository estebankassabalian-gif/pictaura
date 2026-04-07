import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { PRO_PLAN } from "@/config/plans";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = session.user.id;

  // Vérifier si l'utilisateur a déjà un abonnement actif
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSubscribed: true, stripeCustomerId: true, stripeSubscriptionId: true },
  });

  if (user?.isSubscribed && user.stripeSubscriptionId) {
    return NextResponse.json(
      { error: "Vous avez déjà un abonnement actif." },
      { status: 400 }
    );
  }

  const priceId = env.STRIPE_PRICE_PRO;
  if (!priceId) {
    return NextResponse.json({ error: "Configuration Stripe manquante" }, { status: 500 });
  }

  // Récupérer ou créer le Stripe Customer
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

  // Créer la Checkout Session en mode subscription
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success&plan=pro`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/billing?payment=cancelled`,
    metadata: {
      userId,
      planId: PRO_PLAN.id,
    },
    subscription_data: {
      metadata: {
        userId,
        planId: PRO_PLAN.id,
      },
    },
    locale: "fr",
  });

  return NextResponse.json({ url: checkoutSession.url });
}
