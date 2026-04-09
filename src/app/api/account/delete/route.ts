import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import bcrypt from "bcryptjs";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const password = (body as { password?: string }).password;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, role: true, stripeSubscriptionId: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Impossible de supprimer un compte admin
  if (user.role === "ADMIN") {
    return NextResponse.json({ error: "Les comptes administrateurs ne peuvent pas être supprimés" }, { status: 403 });
  }

  // Si le compte a un mot de passe, l'exiger pour confirmer
  if (user.passwordHash) {
    if (!password) {
      return NextResponse.json({ error: "Mot de passe requis pour confirmer la suppression" }, { status: 400 });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 400 });
    }
  }

  // M7: Cancel Stripe subscription before deleting user
  if (user.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(user.stripeSubscriptionId);
    } catch (err) {
      console.error("Failed to cancel Stripe subscription on account delete:", err);
    }
  }

  // Supprimer le compte (cascade Prisma supprime les jobs, photos, transactions)
  await prisma.user.delete({ where: { id: session.user.id } });

  return NextResponse.json({ success: true });
}
