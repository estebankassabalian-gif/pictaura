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
 * Rembourse des crédits sans garde d'idempotence — réservé au rollback d'une
 * création de job qui a ÉCHOUÉ AVANT que la ligne n'existe en DB (aucune
 * ligne à verrouiller, donc aucun concurrent — pipeline/recovery/admin — ne
 * peut jamais rembourser ce même jobId puisqu'il n'a jamais existé). Pour
 * tout remboursement sur un job DÉJÀ créé (échec pendant le traitement, job
 * bloqué, action admin), utiliser `refundJobCredits` : plusieurs chemins
 * peuvent viser le même job en même temps, et seul un ledger verrouillé évite
 * un double remboursement.
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
 * Rembourse un job de façon idempotente, quel que soit le chemin appelant
 * (échec pendant le traitement, récupération de job bloqué, action admin).
 *
 * Problème résolu : `refundCredits` n'a aucune garde — si deux chemins
 * calculent chacun de leur côté "combien manque-t-il ?" et remboursent en
 * parallèle (ex: le pipeline qui échoue au même moment où la récupération de
 * jobs bloqués considère ce job comme mort), le même crédit peut être rendu
 * deux fois. Ici, un seul verrou de ligne (`FOR UPDATE` sur le job) sérialise
 * tous les appelants concurrents, et le montant réellement remboursé est
 * toujours recalculé à partir de la vérité DB : `photoCount - déjà remboursé
 * - déjà livré (COMPLETED)`. Le montant demandé n'est qu'un plafond ; il est
 * automatiquement réduit à ce qui reste réellement dû (0 si déjà tout
 * remboursé). Les appelants peuvent donc sur-demander sans risque (ex:
 * demander tout `photoCount` dans un `catch` générique) plutôt que de tenir
 * un compteur local fragile.
 *
 * @returns le montant RÉELLEMENT remboursé (peut être < requestedAmount, ou 0)
 */
export async function refundJobCredits(
  jobId: string,
  requestedAmount: number,
  description?: string
): Promise<number> {
  if (requestedAmount <= 0) return 0;

  return prisma.$transaction(async (tx) => {
    // Verrouille la ligne du job : un seul appelant à la fois peut lire puis
    // écrire refundedCredits pour ce job, quel que soit le process qui l'appelle.
    const jobRows = await tx.$queryRaw<
      Array<{ id: string; userId: string; photoCount: number; refundedCredits: number }>
    >`
      SELECT id, "userId", "photoCount", "refundedCredits"
      FROM processing_jobs WHERE id = ${jobId} FOR UPDATE
    `;
    const job = jobRows[0];
    if (!job) return 0;

    const user = await tx.user.findUnique({
      where: { id: job.userId },
      select: { role: true, credits: true },
    });
    // Admin : jamais débité à la création du job → jamais remboursé non plus.
    if (!user || user.role === Role.ADMIN) return 0;

    const completedCount = await tx.processedPhoto.count({
      where: { jobId, status: "COMPLETED" },
    });

    const outstanding = Math.max(0, job.photoCount - job.refundedCredits - completedCount);
    const actual = Math.min(requestedAmount, outstanding);
    if (actual <= 0) return 0;

    const newBalance = user.credits + actual;

    await tx.processingJob.update({
      where: { id: jobId },
      data: { refundedCredits: { increment: actual } },
    });
    await tx.user.update({
      where: { id: job.userId },
      data: { credits: { increment: actual } },
    });
    await tx.creditTransaction.create({
      data: {
        userId: job.userId,
        type: TransactionType.REFUND,
        amount: actual,
        balanceAfter: newBalance,
        jobId,
        description: description ?? `Remboursement de ${actual} crédit(s) - traitement échoué`,
      },
    });

    return actual;
  });
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
