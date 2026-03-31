import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { retouchPhoto } from "@/lib/gemini";
import { uploadInpaintingResult, getFreshSignedUrl } from "@/services/storage";
import { INPAINTING_CREDITS_COST, MAX_FILE_SIZE_BYTES } from "@/config/plans";
import { AGENTS } from "@/config/agents";
import { JobStatus, Preset } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { detectMimeFromMagicBytes } from "@/services/storage";

export const maxDuration = 120;

const VALID_PRESETS = ["AIRBNB", "IMMOBILIER", "INSTAGRAM", "VINTED", "SHOPIFY"] as const;

/**
 * POST /api/inpaint-direct
 * Retouche directe depuis un fichier uploadé (sans ProcessedPhoto existant).
 * Même nouveau flow : status AWAITING_VALIDATION, crédit débité à la validation.
 *
 * Sécurité :
 * - Magic bytes validation (empêche upload de fichiers malveillants)
 * - File size validation (max 20 Mo)
 * - Instruction max 300 chars
 * - Rate limit : max 10/heure par user (admin exempt)
 * - Preset validé côté serveur
 * - Error messages sanitisés (pas de fuite d'infos internes)
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  const formData = await req.formData();
  const photo = formData.get("photo") as File | null;
  const instruction = (formData.get("instruction") as string | null)?.trim();
  const platform = formData.get("platform") as string | null;

  // ── Validation entrées ──────────────────────────────────────
  if (!photo || !instruction) {
    return NextResponse.json({ error: "Photo et instruction requises" }, { status: 400 });
  }
  if (instruction.length < 3 || instruction.length > 300) {
    return NextResponse.json({ error: "Instruction : 3 à 300 caractères requis" }, { status: 400 });
  }

  // File size check BEFORE loading into memory
  if (photo.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)" }, { status: 413 });
  }

  // Validate preset
  const preset = VALID_PRESETS.includes(platform as typeof VALID_PRESETS[number])
    ? (platform as Preset)
    : Preset.IMMOBILIER;

  // ── Rate limit : max 10 retouches/heure (admin exempt) ──────
  if (!isAdmin) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.inpaintingJob.count({
      where: { userId, createdAt: { gte: oneHourAgo }, status: { notIn: [JobStatus.REJECTED] } },
    });
    if (recentCount >= 10) {
      return NextResponse.json({ error: "Limite horaire atteinte (10 retouches/heure)" }, { status: 429 });
    }
  }

  // ── Magic bytes validation ──────────────────────────────────
  const originalBuffer = Buffer.from(await photo.arrayBuffer());
  const detectedMime = detectMimeFromMagicBytes(originalBuffer);
  if (!detectedMime) {
    return NextResponse.json({ error: "Fichier invalide : type d'image non reconnu" }, { status: 400 });
  }

  const inpaintingJobId = uuidv4();

  await prisma.inpaintingJob.create({
    data: {
      id: inpaintingJobId,
      userId,
      instruction,
      creditsCost: INPAINTING_CREDITS_COST,
      status: JobStatus.PENDING,
    },
  });

  try {
    const imageBase64 = originalBuffer.toString("base64");

    await prisma.inpaintingJob.update({
      where: { id: inpaintingJobId },
      data: {
        status: JobStatus.PROCESSING,
        replicateModelUsed: "gpt-image-1",
        llmPrompt: instruction,
      },
    });

    const agent = AGENTS[preset];
    const systemPrompt = agent?.systemPrompt ?? "You are a professional photo editor. Perform the requested edits with photorealistic, professional quality.";
    const resultBuffer = await retouchPhoto(imageBase64, instruction, systemPrompt);

    const resultKey = await uploadInpaintingResult(resultBuffer, userId, inpaintingJobId);
    const resultSignedUrl = await getFreshSignedUrl(resultKey);

    await prisma.inpaintingJob.update({
      where: { id: inpaintingJobId },
      data: { resultKey, status: JobStatus.AWAITING_VALIDATION },
    });

    return NextResponse.json({
      resultUrl: resultSignedUrl,
      inpaintingJobId,
      status: "AWAITING_VALIDATION",
      creditsCost: INPAINTING_CREDITS_COST,
    });
  } catch (error) {
    console.error("inpaint-direct error:", error);

    // Sanitize error — never expose internal details to client
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

    return NextResponse.json(
      { error: "Erreur lors de la retouche IA. Aucun crédit débité." },
      { status: 500 }
    );
  }
}
