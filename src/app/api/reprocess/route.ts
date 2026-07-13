import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Preset } from "@prisma/client";
import { deductCreditsAtomic } from "@/services/credits";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/reprocess
 * Relance le traitement d'un job existant avec un autre preset.
 * Réutilise les photos originales déjà stockées sur R2.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json();
  const { jobId, preset } = body;

  if (!jobId || !preset || !Object.values(Preset).includes(preset)) {
    return NextResponse.json({ error: "jobId et preset valide requis" }, { status: 400 });
  }

  // Récupérer le job original et ses photos
  const originalJob = await prisma.processingJob.findFirst({
    where: { id: jobId, userId },
    include: { photos: true },
  });

  if (!originalJob) {
    return NextResponse.json({ error: "Job non trouvé" }, { status: 404 });
  }

  const photoCount = originalJob.photos.length;
  const creditsCost = photoCount;

  // Créer un nouveau job avec le nouveau preset
  const newJobId = uuidv4();

  // Vérifier ET déduire les crédits en une seule transaction atomique (élimine race condition)
  const deducted = await deductCreditsAtomic(userId, creditsCost, newJobId, `Re-traitement ${preset} - ${photoCount} photo(s)`);
  if (!deducted) {
    return NextResponse.json(
      { error: `${creditsCost} crédit(s) requis pour relancer le traitement` },
      { status: 402 }
    );
  }

  // Create job + photos in a single transaction for rollback safety
  try {
    await prisma.$transaction(async (tx) => {
      await tx.processingJob.create({
        data: {
          id: newJobId,
          userId,
          preset: preset as Preset,
          status: "PENDING",
          photoCount,
          creditsCost,
        },
      });

      for (const photo of originalJob.photos) {
        await tx.processedPhoto.create({
          data: {
            jobId: newJobId,
            originalKey: photo.originalKey,
            fileName: photo.fileName,
            fileSizeOriginal: photo.fileSizeOriginal,
            status: "PENDING",
          },
        });
      }
    });
  } catch (error) {
    // Rollback: refund credits since job+photos creation failed
    const { refundCredits } = await import("@/services/credits");
    await refundCredits(userId, creditsCost, newJobId).catch(console.error);
    console.error("Reprocess job creation failed:", error);
    return NextResponse.json({ error: "Erreur lors de la création du job" }, { status: 500 });
  }

  // Publie la demande de traitement dans la file persistante (pg-boss) —
  // survit à un crash/redeploy juste après cette requête, contrairement à un
  // fire-and-forget en mémoire.
  const { enqueueProcessJob } = await import("@/services/processing/queue");
  await enqueueProcessJob(newJobId).catch((err) => {
    console.error(`Échec de la mise en file du reprocess ${newJobId}:`, err);
  });

  return NextResponse.json({ jobId: newJobId }, { status: 201 });
}
