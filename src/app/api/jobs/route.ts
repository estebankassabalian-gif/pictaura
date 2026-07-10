import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Preset } from "@prisma/client";
import { deductCreditsAtomic, refundCredits } from "@/services/credits";
import { failStaleJobs } from "@/services/processing/job-recovery";
import { MAX_PHOTOS_PER_BATCH } from "@/config/plans";
import { checkRateLimit } from "@/lib/rate-limit";
import { v4 as uuidv4 } from "uuid";

const MAX_CONCURRENT_JOBS = 3;

/**
 * POST /api/jobs — Crée un job (sans fichier).
 * Body JSON: { preset, photoCount, instructions?: string[] }
 * Retourne { jobId } — ensuite le client upload chaque photo via /api/jobs/[jobId]/photos
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = session.user.id;

  // Burst protection : 20 créations de jobs max par minute par user (admin exempt)
  if (session.user.role !== "ADMIN" && !checkRateLimit(`jobs:${userId}`, 20, 60 * 1000)) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans quelques secondes." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { preset, photoCount, instructions } = body as {
      preset: string;
      photoCount: number;
      instructions?: string[];
    };

    // Validation
    if (!Object.values(Preset).includes(preset as Preset)) {
      return NextResponse.json({ error: "Preset invalide" }, { status: 400 });
    }

    if (!photoCount || photoCount < 1 || photoCount > MAX_PHOTOS_PER_BATCH) {
      return NextResponse.json(
        { error: `Nombre de photos invalide (1-${MAX_PHOTOS_PER_BATCH})` },
        { status: 400 }
      );
    }

    if (instructions && (!Array.isArray(instructions) || instructions.length !== photoCount)) {
      return NextResponse.json({ error: "Instructions invalides" }, { status: 400 });
    }

    // Auto-nettoyage des jobs morts : basé sur l'inactivité réelle (8 min sans
    // aucune écriture), pas sur l'âge — un gros lot peut légitimement tourner
    // >10 min. Rembourse les crédits des photos jamais livrées.
    await failStaleJobs(userId);

    // Vérifier jobs concurrents
    if (session.user.role !== "ADMIN") {
      const concurrentJobs = await prisma.processingJob.count({
        where: { userId, status: { in: ["PENDING", "PROCESSING"] } },
      });
      if (concurrentJobs >= MAX_CONCURRENT_JOBS) {
        return NextResponse.json(
          { error: "Vous avez trop de traitements en cours. Attendez qu'ils se terminent." },
          { status: 429 }
        );
      }
    }

    // Déduire crédits
    const jobId = uuidv4();
    const deducted = await deductCreditsAtomic(
      userId, photoCount, jobId,
      `Traitement ${preset} - ${photoCount} photo(s)`
    );
    if (!deducted) {
      return NextResponse.json(
        { error: `Crédits insuffisants. ${photoCount} crédit(s) requis.` },
        { status: 402 }
      );
    }

    // Créer le job
    try {
      await prisma.processingJob.create({
        data: {
          id: jobId,
          userId,
          preset: preset as Preset,
          subOption: instructions ? JSON.stringify(instructions) : null,
          status: "PENDING",
          photoCount,
          creditsCost: photoCount,
        },
      });
    } catch (err) {
      await refundCredits(userId, photoCount, jobId).catch(console.error);
      throw err;
    }

    return NextResponse.json({ jobId, photoCount }, { status: 201 });
  } catch (error) {
    console.error("Create job error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du traitement." },
      { status: 500 }
    );
  }
}
