import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { retouchPhoto } from "@/lib/gemini";
import { uploadInpaintingResult, getFreshSignedUrl } from "@/services/storage";
import { INPAINTING_CREDITS_COST } from "@/config/plans";
import { AGENTS } from "@/config/agents";
import { JobStatus } from "@prisma/client";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 120;

const inpaintSchema = z.object({
  photoId: z.string().uuid(),
  instruction: z.string().min(3).max(300),
});

/**
 * POST /api/inpaint
 * Retouche une photo via Gemini 2.0 Flash Image.
 *
 * NOUVEAU FLOW "zéro risque" :
 * 1. Aucun crédit débité à l'appel
 * 2. Gemini retouche → résultat stocké en R2
 * 3. Status = AWAITING_VALIDATION (l'user voit before/after avant de payer)
 * 4. Appeler /api/inpaint-validate pour approuver (débit 1 crédit) ou rejeter (gratuit)
 *
 * Sécurité :
 * - Ownership vérifié côté serveur (photo appartient à userId)
 * - Rate limit : max 10 appels /inpaint par heure par user (DB-based)
 * - Instruction sanitizée dans gemini.ts (max 300 chars, wrapper métier)
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = inpaintSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { photoId, instruction } = parsed.data;
  const userId = session.user.id;

  // ── Rate limiting DB-based (max 10 retouches/heure) ──────────────────
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.inpaintingJob.count({
    where: {
      userId,
      createdAt: { gte: oneHourAgo },
      status: { notIn: [JobStatus.REJECTED] },
    },
  });
  if (recentCount >= 10) {
    return NextResponse.json(
      { error: "Limite horaire atteinte (10 retouches/heure). Réessayez dans quelques minutes." },
      { status: 429 }
    );
  }

  // ── Vérifier que la photo appartient à l'utilisateur ─────────────────
  const photo = await prisma.processedPhoto.findFirst({
    where: {
      id: photoId,
      job: { userId },
      status: JobStatus.COMPLETED,
      processedKey: { not: null },
    },
    include: { job: { select: { preset: true } } },
  });

  if (!photo || !photo.processedKey) {
    return NextResponse.json({ error: "Photo non trouvée ou non traitée" }, { status: 404 });
  }

  const inpaintingJobId = uuidv4();

  // ── Créer le job en PENDING (aucun crédit débité) ─────────────────────
  await prisma.inpaintingJob.create({
    data: {
      id: inpaintingJobId,
      userId,
      photoId,
      instruction,
      creditsCost: INPAINTING_CREDITS_COST,
      status: JobStatus.PENDING,
    },
  });

  try {
    // Télécharger l'image source depuis R2
    const imageUrl = await getFreshSignedUrl(photo.processedKey);
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) throw new Error("Impossible de télécharger l'image source");

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const imageBase64 = imageBuffer.toString("base64");

    await prisma.inpaintingJob.update({
      where: { id: inpaintingJobId },
      data: { status: JobStatus.PROCESSING, replicateModelUsed: "gemini-2.0-flash-image" },
    });

    // ── Retouche via Gemini ───────────────────────────────────────────────
    const agent = AGENTS[photo.job.preset];
    const systemPrompt = agent?.systemPrompt ?? "You are a professional photo editor. Perform the requested edits with photorealistic, professional quality.";
    const resultBuffer = await retouchPhoto(imageBase64, instruction, systemPrompt);

    // ── Upload vers R2 ────────────────────────────────────────────────────
    const resultKey = await uploadInpaintingResult(resultBuffer, userId, inpaintingJobId);
    const resultSignedUrl = await getFreshSignedUrl(resultKey);

    // Status = AWAITING_VALIDATION (crédit PAS encore débité)
    await prisma.inpaintingJob.update({
      where: { id: inpaintingJobId },
      data: {
        resultKey,
        llmPrompt: instruction,
        status: JobStatus.AWAITING_VALIDATION,
      },
    });

    return NextResponse.json({
      inpaintingJobId,
      resultUrl: resultSignedUrl,
      status: "AWAITING_VALIDATION",
      creditsCost: INPAINTING_CREDITS_COST,
    });
  } catch (error) {
    console.error("Inpainting error:", error);

    // Sanitize error — never store or expose API keys, quotas, or internal details
    const sanitizedMsg = error instanceof Error && !error.message.includes("API")
      ? error.message.slice(0, 100)
      : "Erreur de traitement";

    await prisma.inpaintingJob.update({
      where: { id: inpaintingJobId },
      data: {
        status: JobStatus.FAILED,
        errorMsg: sanitizedMsg,
      },
    });

    // Aucun crédit à rembourser (aucun n'a été débité)
    return NextResponse.json(
      { error: "Erreur lors de la retouche IA. Aucun crédit débité." },
      { status: 500 }
    );
  }
}
