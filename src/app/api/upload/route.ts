import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Preset } from "@prisma/client";
import { deductCreditsAtomic, refundCredits } from "@/services/credits";
import { uploadOriginalPhoto, validateImageFile, detectMimeFromMagicBytes } from "@/services/storage";
import {
  MAX_PHOTOS_PER_BATCH,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_IMAGE_TYPES,
} from "@/config/plans";
import { v4 as uuidv4 } from "uuid";
import { detectBlur } from "@/services/blur-detection";

export const maxDuration = 120;
export const config = { api: { bodyParser: false } };

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
    // Per-photo instructions: JSON array matching files order, or empty for global subOption
    let photoInstructions: string[] = [];
    const instructionsRaw = formData.get("instructions") as string | null;
    if (instructionsRaw) {
      try { photoInstructions = JSON.parse(instructionsRaw); } catch { /* ignore */ }
    }

    // ── Validation ────────────────────────────────────────────
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

    // Valider chaque fichier (MIME déclaré + taille + magic bytes)
    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
        return NextResponse.json(
          { error: "Type de fichier non supporté" },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `Fichier trop volumineux (max 20 Mo)` },
          { status: 400 }
        );
      }
      // Magic bytes validation — vérifie le contenu réel du fichier
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const detectedMime = detectMimeFromMagicBytes(fileBuffer);
      if (!detectedMime) {
        return NextResponse.json(
          { error: "Fichier invalide : type d'image non reconnu" },
          { status: 400 }
        );
      }
    }

    // ── Vérifier crédits ──────────────────────────────────────
    const creditsCost = files.length;

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
        where: {
          userId,
          status: { in: ["PENDING", "PROCESSING"] },
        },
      });
      if (concurrentJobs >= MAX_CONCURRENT_JOBS) {
        return NextResponse.json(
          { error: "Vous avez trop de traitements en cours. Attendez qu'ils se terminent." },
          { status: 429 }
        );
      }
    }

    // ── Créer le job ──────────────────────────────────────────
    const jobId = uuidv4();

    // Déduire les crédits AVANT d'uploader (atomique — check + deduct en une seule transaction)
    const deducted = await deductCreditsAtomic(userId, creditsCost, jobId, `Traitement ${preset} - ${files.length} photo(s)`);
    if (!deducted) {
      return NextResponse.json(
        { error: `Crédits insuffisants. ${creditsCost} crédit(s) requis.` },
        { status: 402 }
      );
    }

    const job = await prisma.processingJob.create({
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

    // ── Upload chaque photo vers R2 ───────────────────────────
    const photoRecords = [];
    const uploadedKeys: string[] = [];
    const blurWarnings: string[] = [];

    try {
      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx];
        const buffer = Buffer.from(await file.arrayBuffer());

        // Détection de flou (non bloquant — juste un warning)
        const blurResult = await detectBlur(buffer);
        if (blurResult.isBlurry && blurResult.message) {
          blurWarnings.push(`${file.name} : ${blurResult.message}`);
        }

        const { key } = await uploadOriginalPhoto(
          buffer,
          file.type,
          file.name,
          userId,
          jobId
        );
        uploadedKeys.push(key);

        // Per-photo instruction, or fallback to global subOption
        const photoInstruction = photoInstructions[idx] || subOption || null;

        const photo = await prisma.processedPhoto.create({
          data: {
            jobId,
            originalKey: key,
            fileName: file.name,
            fileSizeOriginal: file.size,
            instruction: photoInstruction,
            status: "PENDING",
          },
        });

        photoRecords.push(photo.id);
      }
    } catch (uploadError) {
      // Nettoyage R2 : supprimer les fichiers déjà uploadés
      console.error("Upload partiel échoué, nettoyage R2...", uploadError);
      const { deleteFromR2 } = await import("@/lib/r2");
      for (const key of uploadedKeys) {
        try { await deleteFromR2(key); } catch { /* best effort */ }
      }
      // Marquer le job comme échoué et rembourser les crédits
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
