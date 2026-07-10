import { prisma } from "@/lib/prisma";
import { JobStatus } from "@prisma/client";
import { refundCredits } from "@/services/credits";

/**
 * Détection de jobs morts basée sur l'ACTIVITÉ réelle, pas sur l'âge.
 *
 * L'ancien cleanup marquait FAILED tout job PENDING/PROCESSING créé il y a
 * plus de 10 min — or un lot de 30 photos à 60-150s/photo dépasse facilement
 * 10 min en tournant parfaitement. Et il ne remboursait pas les crédits.
 *
 * Un job VIVANT laisse des traces : chaque photo passe PROCESSING → COMPLETED
 * (updatedAt touché), le budget max par photo étant 5 min (deadline Gemini).
 * Donc un job sans AUCUNE écriture (job ou photos) depuis 8 min est mort :
 * le process qui le portait a crashé ou a été tué par un redeploy.
 */
const INACTIVITY_THRESHOLD_MS = 8 * 60 * 1000;

/**
 * Marque FAILED les jobs sans activité depuis 8 min et rembourse les crédits
 * des photos jamais livrées (PENDING/PROCESSING + photos jamais uploadées).
 * Les photos FAILED ont déjà été remboursées au fil de l'eau ; les COMPLETED
 * ont été livrées — ni l'une ni l'autre n'est re-remboursée.
 *
 * @param userId limite le scan à un utilisateur (appel à la création de job) ;
 *               omis = scan global (appel au boot du serveur).
 * @returns nombre de jobs récupérés
 */
export async function failStaleJobs(userId?: string): Promise<number> {
  const cutoff = new Date(Date.now() - INACTIVITY_THRESHOLD_MS);

  const candidates = await prisma.processingJob.findMany({
    where: {
      ...(userId ? { userId } : {}),
      status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] },
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      userId: true,
      photoCount: true,
      photos: { select: { status: true, updatedAt: true } },
    },
  });

  let recovered = 0;
  for (const job of candidates) {
    const lastPhotoActivity = job.photos.reduce(
      (max, p) => (p.updatedAt > max ? p.updatedAt : max),
      new Date(0)
    );
    if (lastPhotoActivity >= cutoff) continue; // une photo bouge encore → job vivant

    const completedCount = job.photos.filter((p) => p.status === JobStatus.COMPLETED).length;
    const failedCount = job.photos.filter((p) => p.status === JobStatus.FAILED).length;
    // Crédits déduits = photoCount. Non livrés = tout sauf COMPLETED (livré)
    // et FAILED (déjà remboursé photo par photo dans le pipeline).
    const toRefund = Math.max(0, job.photoCount - completedCount - failedCount);

    await prisma.processedPhoto.updateMany({
      where: { jobId: job.id, status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] } },
      data: { status: JobStatus.FAILED },
    });
    await prisma.processingJob.update({
      where: { id: job.id },
      data: {
        status: completedCount > 0 ? JobStatus.COMPLETED : JobStatus.FAILED,
        completedAt: new Date(),
        errorMsg:
          completedCount > 0
            ? `Traitement interrompu : ${completedCount}/${job.photoCount} photo(s) livrée(s), le reste a été remboursé.`
            : "Traitement interrompu — crédits remboursés.",
      },
    });
    if (toRefund > 0) {
      await refundCredits(job.userId, toRefund, job.id).catch(console.error);
    }
    console.warn(
      `Job ${job.id} récupéré (inactif >8 min) : ${completedCount} livrée(s), ${toRefund} crédit(s) remboursé(s)`
    );
    recovered++;
  }
  return recovered;
}

/**
 * Récupération au boot : après un redeploy/crash, les jobs portés par l'ancien
 * process ne reprendront jamais. On applique la même détection d'inactivité
 * (un déploiement rolling peut laisser l'ancien conteneur finir son travail
 * pendant quelques minutes — on ne tue que ce qui est réellement silencieux).
 */
export async function recoverOrphanedJobsOnBoot(): Promise<void> {
  try {
    const n = await failStaleJobs();
    if (n > 0) console.warn(`Boot recovery : ${n} job(s) orphelin(s) récupéré(s)`);
  } catch (err) {
    console.error("Boot recovery failed:", err);
  }
}
