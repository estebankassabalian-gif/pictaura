import { prisma } from "@/lib/prisma";
import { JobStatus, Role, TransactionType } from "@prisma/client";
import { failHintFor } from "@/services/processing/fail-hint";

export type RetryPhotoResult =
  | { ok: true; charged: boolean }
  | {
      ok: false;
      reason: "not_found" | "not_failed" | "job_running" | "not_retryable" | "insufficient_credits";
    };

/**
 * Remet UNE photo en échec dans la file de son lot.
 *
 * Cohérence avec le ledger de remboursement (refundJobCredits) : le montant
 * encore dû à un job vaut photoCount - refundedCredits - photos COMPLETED.
 * Le lot étant terminé, ce montant est le nombre de crédits que le lot retient
 * encore SANS avoir livré de photo (typiquement : un remboursement qui a
 * échoué).
 *   - Montant > 0 : un crédit déjà payé et non livré couvre la relance, rien
 *     n'est re-débité. Débiter ici ferait payer deux fois ce client.
 *   - Montant = 0 (cas normal, la photo a été remboursée) : la relance
 *     « annule » ce remboursement — 1 crédit re-débité, refundedCredits
 *     décrémenté — dans la MÊME transaction. Si la relance réussit, la photo
 *     est payée une fois ; si elle échoue encore, le ledger revoit 1 crédit dû
 *     et le rend.
 *
 * Le job est verrouillé (FOR UPDATE) : deux clics simultanés, ou une relance
 * concurrente d'un remboursement, ne peuvent pas désynchroniser le ledger.
 */
export async function retryFailedPhoto(
  jobId: string,
  photoId: string,
  sessionUserId: string,
  isAdminSession: boolean
): Promise<RetryPhotoResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const jobRows = await tx.$queryRaw<
        Array<{
          id: string;
          userId: string;
          status: JobStatus;
          photoCount: number;
          refundedCredits: number;
        }>
      >`
        SELECT id, "userId", status, "photoCount", "refundedCredits"
        FROM processing_jobs WHERE id = ${jobId} FOR UPDATE
      `;
      const job = jobRows[0];
      if (!job || (!isAdminSession && job.userId !== sessionUserId)) {
        return { ok: false, reason: "not_found" } as const;
      }
      // Lot encore en cours : son runner a déjà dépassé cette photo et ne la
      // reprendrait pas. Relancer à la fin du lot.
      if (job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING) {
        return { ok: false, reason: "job_running" } as const;
      }

      const photo = await tx.processedPhoto.findFirst({
        where: { id: photoId, jobId },
        select: { status: true, failReason: true },
      });
      if (!photo) return { ok: false, reason: "not_found" } as const;
      if (photo.status !== JobStatus.FAILED) return { ok: false, reason: "not_failed" } as const;
      if (!failHintFor(photo.failReason).retryable) {
        return { ok: false, reason: "not_retryable" } as const;
      }

      // Le crédit est celui du propriétaire du lot, même si un admin relance.
      const ownerRows = await tx.$queryRaw<Array<{ credits: number; role: Role }>>`
        SELECT credits, role FROM users WHERE id = ${job.userId} FOR UPDATE
      `;
      const owner = ownerRows[0];
      if (!owner) return { ok: false, reason: "not_found" } as const;

      const completedCount = await tx.processedPhoto.count({
        where: { jobId, status: JobStatus.COMPLETED },
      });
      const heldUndelivered = job.photoCount - job.refundedCredits - completedCount;
      // heldUndelivered <= 0 et photo non livrée => refundedCredits >= 1 :
      // la décrémentation ci-dessous ne peut pas passer sous zéro.
      const charge = owner.role !== Role.ADMIN && heldUndelivered <= 0;
      if (charge) {
        if (owner.credits < 1) return { ok: false, reason: "insufficient_credits" } as const;
        await tx.user.update({
          where: { id: job.userId },
          data: { credits: { decrement: 1 } },
        });
        await tx.creditTransaction.create({
          data: {
            userId: job.userId,
            type: TransactionType.USAGE,
            amount: -1,
            balanceAfter: owner.credits - 1,
            jobId,
            description: "Relance d'une photo en échec",
          },
        });
        await tx.processingJob.update({
          where: { id: jobId },
          data: { refundedCredits: { decrement: 1 } },
        });
      }

      await tx.processedPhoto.update({
        where: { id: photoId },
        data: { status: JobStatus.PENDING, failReason: null, processingMs: null },
      });
      await tx.processingJob.update({
        where: { id: jobId },
        data: { status: JobStatus.PENDING, completedAt: null, errorMsg: null },
      });

      return { ok: true, charged: charge } as const;
    });
  } catch (err) {
    console.error(`Relance impossible (job ${jobId}, photo ${photoId}):`, err);
    throw err;
  }
}
