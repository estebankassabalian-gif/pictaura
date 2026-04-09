import { prisma } from "@/lib/prisma";
import { Role, TransactionType } from "@prisma/client";

/**
 * Vérifie si un utilisateur a assez de crédits.
 * Les admins ont toujours assez de crédits.
 */
export async function hasEnoughCredits(
  userId: string,
  amount: number
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true, role: true },
  });
  if (!user) return false;
  if (user.role === Role.ADMIN) return true;
  return user.credits >= amount;
}

/**
 * Déduit des crédits de façon atomique avec piste d'audit.
 * Les admins ne sont JAMAIS débités.
 * @throws Error si l'utilisateur n'a pas assez de crédits
 */
export async function deductCredits(
  userId: string,
  amount: number,
  jobId?: string,
  description?: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true, role: true },
  });

  if (!user) throw new Error("Utilisateur non trouvé");
  if (user.role === Role.ADMIN) return; // Admin : jamais débité

  if (user.credits < amount) {
    throw new Error(`Crédits insuffisants (${user.credits} disponibles, ${amount} requis)`);
  }

  const newBalance = user.credits - amount;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: amount } },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        type: TransactionType.USAGE,
        amount: -amount,
        balanceAfter: newBalance,
        jobId,
        description: description ?? `${amount} crédit(s) utilisé(s)`,
      },
    }),
  ]);
}

/**
 * Vérifie ET déduit les crédits en une seule transaction interactive.
 * Uses SELECT FOR UPDATE to prevent race conditions between concurrent requests.
 * @returns true si la déduction a réussi, false si crédits insuffisants
 */
export async function deductCreditsAtomic(
  userId: string,
  amount: number,
  jobId?: string,
  description?: string
): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      // SELECT FOR UPDATE locks the row until transaction completes
      const rows = await tx.$queryRaw<Array<{ credits: number; role: string }>>`
        SELECT credits, role FROM users WHERE id = ${userId} FOR UPDATE
      `;

      if (!rows[0]) throw new Error("Utilisateur non trouvé");
      if (rows[0].role === "ADMIN") return; // Admin : jamais débité

      if (rows[0].credits < amount) {
        throw new Error("INSUFFICIENT_CREDITS");
      }

      const newBalance = rows[0].credits - amount;

      await tx.user.update({
        where: { id: userId },
        data: { credits: { decrement: amount } },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          type: TransactionType.USAGE,
          amount: -amount,
          balanceAfter: newBalance,
          jobId,
          description: description ?? `${amount} crédit(s) utilisé(s)`,
        },
      });
    });
    return true;
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_CREDITS") {
      return false;
    }
    throw err;
  }
}

/**
 * Rembourse des crédits (ex: si le traitement échoue).
 * Crée une transaction REFUND dans l'historique.
 */
export async function refundCredits(
  userId: string,
  amount: number,
  jobId?: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true, role: true },
  });

  if (!user || user.role === Role.ADMIN) return;

  const newBalance = user.credits + amount;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        type: TransactionType.REFUND,
        amount,
        balanceAfter: newBalance,
        jobId,
        description: `Remboursement de ${amount} crédit(s) - traitement échoué`,
      },
    }),
  ]);
}

/**
 * Ajoute des crédits suite à un achat Stripe.
 * Idempotent : the unique constraint on stripePaymentIntentId prevents double-crediting.
 * Check + insert are inside the same interactive transaction to eliminate the race window.
 */
export async function addCreditsFromPurchase(
  userId: string,
  amount: number,
  stripePaymentIntentId: string,
  description?: string
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      // Check idempotence inside the transaction
      const existing = await tx.creditTransaction.findUnique({
        where: { stripePaymentIntentId },
      });
      if (existing) return; // Already processed

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });
      if (!user) throw new Error("Utilisateur non trouvé");

      const newBalance = user.credits + amount;

      await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          type: TransactionType.PURCHASE,
          amount,
          balanceAfter: newBalance,
          stripePaymentIntentId,
          description: description ?? `Achat de ${amount} crédit(s)`,
        },
      });
    });
  } catch (err) {
    // Handle unique constraint violation gracefully (concurrent webhook retry)
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return; // Already processed — idempotent
    }
    throw err;
  }
}

/**
 * Ajoute des crédits manuellement (admin uniquement).
 */
export async function adminGrantCredits(
  userId: string,
  amount: number,
  adminId: string
): Promise<void> {
  if (!Number.isInteger(amount) || amount <= 0 || amount > 10000) {
    throw new Error("Montant invalide (1-10000)");
  }

  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { role: true },
  });
  if (admin?.role !== Role.ADMIN) throw new Error("Non autorisé");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  if (!user) throw new Error("Utilisateur non trouvé");

  const newBalance = user.credits + amount;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        type: TransactionType.ADMIN_GRANT,
        amount,
        balanceAfter: newBalance,
        description: `Crédit manuel par l'admin (${amount} crédits)`,
      },
    }),
  ]);
}
