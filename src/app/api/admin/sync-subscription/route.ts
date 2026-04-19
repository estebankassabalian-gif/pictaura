import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { addCreditsFromPurchase } from "@/services/credits";
import { PLANS } from "@/config/plans";

/**
 * POST /api/admin/sync-subscription
 * Synchronise l'abonnement Stripe d'un utilisateur : active isSubscribed + ajoute les crédits manquants.
 * Utile si le webhook a raté un événement checkout.session.completed.
 * Accès admin uniquement.
 *
 * Body : { userId: string } — ou sans body pour sync le user connecté (admin).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const targetUserId = body?.userId ?? session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, stripeCustomerId: true, isSubscribed: true, credits: true, stripeSubscriptionId: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  }

  if (!user.stripeCustomerId) {
    return NextResponse.json({ error: "Aucun customer Stripe associé" }, { status: 400 });
  }

  // Chercher les subscriptions actives du customer Stripe
  const subscriptions = await stripe.subscriptions.list({
    customer: user.stripeCustomerId,
    status: "active",
    limit: 1,
  });

  if (subscriptions.data.length === 0) {
    return NextResponse.json({
      error: "Aucun abonnement actif trouvé sur Stripe",
      stripeCustomerId: user.stripeCustomerId,
    }, { status: 404 });
  }

  const activeSub = subscriptions.data[0];
  const periodEnd = new Date(activeSub.current_period_end * 1000);
  const subMeta = activeSub.metadata as { planId?: string; interval?: string } | undefined;
  // Par défaut : "pro" — tier du milieu, plus proche des anciens abonnés legacy (500 crédits).
  const plan = PLANS.find((p) => p.id === subMeta?.planId) ?? PLANS[1];
  const interval = subMeta?.interval === "year" ? "year" : "month";

  // Activer l'abonnement en DB
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isSubscribed: true,
      planId: plan.id,
      billingInterval: interval,
      stripeSubscriptionId: activeSub.id,
      subscriptionEndsAt: periodEnd,
    },
  });

  // Ajouter les crédits (idempotent — ne double pas si déjà fait)
  let creditsAdded = false;
  try {
    await addCreditsFromPurchase(
      user.id,
      plan.creditsPerMonth,
      `sub_sync_${activeSub.id}`,
      `Sync admin — ${plan.name} — ${plan.creditsPerMonth} crédits`
    );
    creditsAdded = true;
  } catch {
    creditsAdded = false;
  }

  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { credits: true, isSubscribed: true },
  });

  return NextResponse.json({
    success: true,
    plan: plan.name,
    creditsAdded,
    creditsBefore: user.credits,
    creditsAfter: updatedUser?.credits,
    subscriptionId: activeSub.id,
    periodEnd: periodEnd.toISOString(),
  });
}
