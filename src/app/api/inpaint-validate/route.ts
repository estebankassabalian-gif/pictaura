import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deductCreditsAtomic } from "@/services/credits";
import { getFreshSignedUrl } from "@/services/storage";
import { INPAINTING_CREDITS_COST } from "@/config/plans";
import { JobStatus } from "@prisma/client";
import { z } from "zod";

const schema = z.object({
  inpaintingJobId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
});

/**
 * POST /api/inpaint-validate
 * Valide ou rejette un résultat de retouche en attente.
 *
 * approve → débite 1 crédit atomiquement, status = COMPLETED
 * reject  → status = REJECTED, AUCUN crédit débité
 *
 * Sécurité :
 * - Ownership vérifié (inpaintingJob.userId === session.user.id)
 * - Idempotent : guard sur status === AWAITING_VALIDATION (transaction atomique)
 * - Crédits déduits côté serveur uniquement, jamais depuis le client
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const { inpaintingJobId, action } = parsed.data;
  const userId = session.user.id;

  if (action === "approve") {
    // ── APPROVE : déduire 1 crédit + finaliser ───────────────────────────
    try {
      let resultUrl: string | null = null;

      await prisma.$transaction(async (tx) => {
        // Guard idempotent : le job doit être en AWAITING_VALIDATION et appartenir à cet user
        const job = await tx.inpaintingJob.findFirst({
          where: { id: inpaintingJobId, userId, status: JobStatus.AWAITING_VALIDATION },
        });
        if (!job) throw new Error("JOB_NOT_FOUND_OR_ALREADY_PROCESSED");

        // Vérifier les crédits (côté serveur — jamais depuis le client)
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { credits: true, role: true },
        });
        if (!user) throw new Error("USER_NOT_FOUND");

        const { Role } = await import("@prisma/client");
        const isAdmin = user.role === Role.ADMIN;

        if (!isAdmin && user.credits < INPAINTING_CREDITS_COST) {
          throw new Error("INSUFFICIENT_CREDITS");
        }

        // Déduire le crédit
        if (!isAdmin) {
          const newBalance = user.credits - INPAINTING_CREDITS_COST;
          await tx.user.update({
            where: { id: userId },
            data: { credits: { decrement: INPAINTING_CREDITS_COST } },
          });
          const { TransactionType } = await import("@prisma/client");
          await tx.creditTransaction.create({
            data: {
              userId,
              type: TransactionType.USAGE,
              amount: -INPAINTING_CREDITS_COST,
              balanceAfter: newBalance,
              jobId: inpaintingJobId,
              description: `Retouche IA validée — ${INPAINTING_CREDITS_COST} crédit(s)`,
            },
          });
        }

        // Finaliser le job
        const updated = await tx.inpaintingJob.update({
          where: { id: inpaintingJobId },
          data: { status: JobStatus.COMPLETED },
          select: { resultKey: true, photoId: true },
        });
        resultUrl = updated.resultKey;

        // Remplacer la photo principale par le résultat de la retouche
        if (updated.photoId && updated.resultKey) {
          await tx.processedPhoto.update({
            where: { id: updated.photoId },
            data: { processedKey: updated.resultKey },
          });
        }
      });

      // Générer l'URL signée du résultat final
      let signedUrl: string | null = null;
      if (resultUrl) {
        signedUrl = await getFreshSignedUrl(resultUrl).catch(() => null);
      }

      return NextResponse.json({ status: "COMPLETED", resultUrl: signedUrl });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "JOB_NOT_FOUND_OR_ALREADY_PROCESSED") {
          return NextResponse.json({ error: "Job introuvable ou déjà traité" }, { status: 404 });
        }
        if (error.message === "INSUFFICIENT_CREDITS") {
          return NextResponse.json({ error: "Crédits insuffisants" }, { status: 402 });
        }
      }
      console.error("inpaint-validate approve error:", error);
      return NextResponse.json({ error: "Erreur lors de la validation" }, { status: 500 });
    }
  } else {
    // ── REJECT : marquer comme rejeté, aucun crédit débité ──────────────
    try {
      await prisma.$transaction(async (tx) => {
        // Guard idempotent : doit être AWAITING_VALIDATION et appartenir à cet user
        const job = await tx.inpaintingJob.findFirst({
          where: { id: inpaintingJobId, userId, status: JobStatus.AWAITING_VALIDATION },
        });
        if (!job) throw new Error("JOB_NOT_FOUND_OR_ALREADY_PROCESSED");

        await tx.inpaintingJob.update({
          where: { id: inpaintingJobId },
          data: { status: JobStatus.REJECTED },
        });
      });

      return NextResponse.json({ status: "REJECTED" });
    } catch (error) {
      if (error instanceof Error && error.message === "JOB_NOT_FOUND_OR_ALREADY_PROCESSED") {
        return NextResponse.json({ error: "Job introuvable ou déjà traité" }, { status: 404 });
      }
      console.error("inpaint-validate reject error:", error);
      return NextResponse.json({ error: "Erreur lors du rejet" }, { status: 500 });
    }
  }
}
