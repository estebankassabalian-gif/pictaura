import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { PLANS, getPlan, type PlanId } from "@/config/plans";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = session.user.id;

  const body = await req.json().catch(() => ({}));
  const planId = (body?.planId ?? "immobilier") as PlanId;

  if (!PLANS.some((p) => p.id === planId)) {
    return NextResponse.json({ error: "Plan inconnu" }, { status: 400 });
  }

  const plan = getPlan(planId);

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

  const priceId = (env as Record<string, string | undefined>)[plan.stripePriceEnvKey];
  if (!priceId) {
    return NextResponse.json(
      { error: `Configuration Stripe manquante : ${plan.stripePriceEnvKey}` },
      { status: 500 }
    );
  }

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
      mode: "subscription",
      success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success&plan=${plan.id}`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/billing?payment=cancelled`,
      metadata: {
        userId,
        planId: plan.id,
      },
      subscription_data: {
        metadata: {
          userId,
          planId: plan.id,
        },
      },
      locale: "fr",
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la session de paiement. Réessayez." },
      { status: 500 }
    );
  }
}
