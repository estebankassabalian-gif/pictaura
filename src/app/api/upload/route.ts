import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Preset } from "@prisma/client";
import { deductCreditsAtomic, refundCredits } from "@/services/credits";
import { uploadOriginalPhoto, detectMimeFromMagicBytes } from "@/services/storage";
import {
  MAX_PHOTOS_PER_BATCH,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_IMAGE_TYPES,
} from "@/config/plans";
import { v4 as uuidv4 } from "uuid";
import { detectBlur } from "@/services/blur-detection";

export const maxDuration = 120;

// Rate limiting simple par session (max 3 jobs en cours)
const MAX_CONCURRENT_JOBS = 3;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const formData = await req.formData();
    const preset = formData.get("preset") as string;
    const subOption = (formData.get("subOption") as string | null) ?? undefined;
    const files = formData.getAll("photos") as File[];

    // Per-photo instructions: JSON array matching files order
    let photoInstructions: string[] = [];
    const instructionsRaw = formData.get("instructions") as string | null;
    if (instructionsRaw) {
      try {
        const parsed = JSON.parse(instructionsRaw);
        if (!Array.isArray(parsed) || !parsed.every((v: unknown) => typeof v === "string")) {
          return NextResponse.json({ error: "Format d'instructions invalide" }, { status: 400 });
        }
        photoInstructions = parsed;
      } catch {
        return NextResponse.json({ error: "Format d'instructions invalide" }, { status: 400 });
      }
    }

    // ── Validation légère (sans charger les fichiers en mémoire) ──
    if (!Object.values(Preset).includes(preset as Preset)) {
      return NextResponse.json({ error: "Preset invalide" }, { status: 400 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Aucune photo fournie" }, { status: 400 });
    }

    if (files.length > MAX_PHOTOS_PER_BATCH) {
      return NextResponse.json(
        { error: `Maximum ${MAX_PHOTOS_PER_BATCH} photos par lot` },
        { status: 400 }
      );
    }

    // Valider type et taille SANS lire les buffers
    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
        return NextResponse.json({ error: `Type de fichier non supporté : ${file.name}` }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: `Fichier trop volumineux : ${file.name} (max 20 Mo)` }, { status: 400 });
      }
    }

    // ── Auto-nettoyage des jobs bloqués (>10 min) ────────────
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    await prisma.processingJob.updateMany({
      where: {
        userId,
        status: { in: ["PENDING", "PROCESSING"] },
        createdAt: { lt: tenMinutesAgo },
      },
      data: { status: "FAILED", errorMsg: "Timeout automatique (>10 min)" },
    });

    // ── Vérifier jobs concurrents (admin illimité) ────────────
    const userRole = session.user.role;
    if (userRole !== "ADMIN") {
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

    // ── Créer le job + déduire crédits ───────────────────────
    const creditsCost = files.length;
    const jobId = uuidv4();

    const deducted = await deductCreditsAtomic(userId, creditsCost, jobId, `Traitement ${preset} - ${files.length} photo(s)`);
    if (!deducted) {
      return NextResponse.json(
        { error: `Crédits insuffisants. ${creditsCost} crédit(s) requis.` },
        { status: 402 }
      );
    }

    try {
      await prisma.processingJob.create({
        data: {
          id: jobId,
          userId,
          preset: preset as Preset,
          subOption: subOption ?? null,
          status: "PENDING",
          photoCount: files.length,
          creditsCost,
        },
      });
    } catch (jobCreateError) {
      await refundCredits(userId, creditsCost, jobId).catch(console.error);
      throw jobCreateError;
    }

    // ── Upload photo par photo (1 seul buffer en mémoire à la fois) ──
    const uploadedKeys: string[] = [];
    const blurWarnings: string[] = [];

    try {
      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx];

        // Lire UNE photo en mémoire
        const buffer = Buffer.from(await file.arrayBuffer());

        // Valider les magic bytes
        const detectedMime = detectMimeFromMagicBytes(buffer);
        if (!detectedMime) {
          throw new Error(`Fichier invalide : ${file.name} — type d'image non reconnu`);
        }

        // Détection de flou (non bloquant)
        try {
          const blurResult = await detectBlur(buffer);
          if (blurResult.isBlurry && blurResult.message) {
            blurWarnings.push(`${file.name} : ${blurResult.message}`);
          }
        } catch { /* blur detection failed — ignore */ }

        // Upload vers R2
        const { key } = await uploadOriginalPhoto(buffer, file.type, file.name, userId, jobId);
        uploadedKeys.push(key);

        // Créer le record en DB
        const photoInstruction = photoInstructions[idx] || subOption || null;
        await prisma.processedPhoto.create({
          data: {
            jobId,
            originalKey: key,
            fileName: file.name,
            fileSizeOriginal: file.size,
            instruction: photoInstruction,
            status: "PENDING",
          },
        });

        // Le buffer est libéré ici (plus de référence) → le GC peut récupérer la mémoire
      }
    } catch (uploadError) {
      console.error("Upload partiel échoué, nettoyage R2...", uploadError);
      const { deleteFromR2 } = await import("@/lib/r2");
      for (const key of uploadedKeys) {
        try { await deleteFromR2(key); } catch { /* best effort */ }
      }
      await prisma.processingJob.update({
        where: { id: jobId },
        data: { status: "FAILED", errorMsg: "Échec de l'upload" },
      });
      await refundCredits(userId, creditsCost, jobId).catch(console.error);
      throw uploadError;
    }

    return NextResponse.json({
      jobId,
      photoCount: files.length,
      warnings: blurWarnings.length > 0 ? blurWarnings : undefined,
    }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload. Vos crédits ont été préservés." },
      { status: 500 }
    );
  }
}
