import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { CREDIT_PACKS } from "@/config/plans";
import { z } from "zod";

const checkoutSchema = z.object({
  packId: z.enum(["starter", "pro", "studio"]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Pack invalide" }, { status: 400 });
  }

  const { packId } = parsed.data;
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) {
    return NextResponse.json({ error: "Pack non trouvé" }, { status: 404 });
  }

  // Map explicite — évite d'accéder à des secrets arbitraires via process.env[userControlledKey]
  const priceIdMap: Record<string, string | undefined> = {
    STRIPE_PRICE_STARTER: env.STRIPE_PRICE_STARTER,
    STRIPE_PRICE_PRO: env.STRIPE_PRICE_PRO,
    STRIPE_PRICE_STUDIO: env.STRIPE_PRICE_STUDIO,
  };
  const priceId = priceIdMap[pack.stripePriceEnvKey];
  if (!priceId) {
    return NextResponse.json({ error: "Configuration Stripe manquante" }, { status: 500 });
  }

  // Récupérer ou créer le Stripe Customer pour cet utilisateur
  let stripeCustomerId = await prisma.user
    .findUnique({ where: { id: session.user.id }, select: { stripeCustomerId: true } })
    .then((u) => u?.stripeCustomerId);

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: session.user.email,
      name: session.user.name ?? undefined,
      metadata: { userId: session.user.id },
    });
    stripeCustomerId = customer.id;
    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId },
    });
  }

  // Créer la Checkout Session
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard?payment=success&credits=${pack.credits}`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/billing?payment=cancelled`,
    metadata: {
      userId: session.user.id,
      packId,
      credits: String(pack.credits),
    },
    // Activer les reçus automatiques
    payment_intent_data: {
      description: `Pictaura — ${pack.name} (${pack.credits} crédits)`,
      metadata: {
        userId: session.user.id,
        packId,
        credits: String(pack.credits),
      },
    },
    locale: "fr",
  });

  return NextResponse.json({ url: checkoutSession.url });
}
