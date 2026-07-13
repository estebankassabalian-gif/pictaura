import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadOriginalPhoto, detectMimeFromMagicBytes } from "@/services/storage";
import { uploadToR2 } from "@/lib/r2";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB, ALLOWED_IMAGE_TYPES } from "@/config/plans";
import { detectBlur } from "@/services/blur-detection";
import {
  resizeIfLarger,
  renditionKeyFor,
  GEMINI_INPUT_MAX_EDGE,
} from "@/services/processing/pipeline";
import { enqueueProcessJob } from "@/services/processing/queue";

export const maxDuration = 60;

/**
 * POST /api/jobs/[jobId]/photos — Upload UNE photo à la fois.
 * FormData: { photo: File, index: number, instruction?: string }
 * Chaque requête = 1 seule photo → pas de problème mémoire.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { jobId } = await params;

  // Vérifier que le job existe et appartient à l'utilisateur.
  // PROCESSING accepté : le pipeline démarre dès la 1ère photo (streaming),
  // les suivantes continuent d'arriver pendant que le traitement tourne.
  const job = await prisma.processingJob.findFirst({
    where: { id: jobId, userId: session.user.id, status: { in: ["PENDING", "PROCESSING"] } },
    include: { _count: { select: { photos: true } } },
  });

  if (!job) {
    return NextResponse.json({ error: "Job non trouvé ou déjà lancé" }, { status: 404 });
  }

  // Vérifier qu'on n'a pas déjà toutes les photos
  if (job._count.photos >= job.photoCount) {
    return NextResponse.json({ error: "Toutes les photos sont déjà uploadées" }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("photo") as File | null;
    const instruction = (formData.get("instruction") as string | null) || null;
    const rawPlatformId = (formData.get("platformId") as string | null) || null;
    // Whitelist : platformId doit matcher le format des IDs déclarés dans platforms.ts
    // (lettres, chiffres, tirets — pas d'injection de chemin ou de payload inattendu).
    const platformId = rawPlatformId && /^[a-z0-9-]{1,40}$/i.test(rawPlatformId) ? rawPlatformId : null;

    if (!file) {
      return NextResponse.json({ error: "Aucune photo fournie" }, { status: 400 });
    }

    // Valider type et taille
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
      return NextResponse.json({ error: `Type non supporté : ${file.name}` }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: `Fichier trop volumineux : ${file.name} (max ${MAX_FILE_SIZE_MB} Mo)` }, { status: 400 });
    }

    // Lire le buffer (1 seule photo, taille déjà validée ci-dessus)
    const buffer = Buffer.from(await file.arrayBuffer());

    // Valider magic bytes
    const detectedMime = detectMimeFromMagicBytes(buffer);
    if (!detectedMime) {
      return NextResponse.json({ error: `Fichier invalide : ${file.name}` }, { status: 400 });
    }

    // Détection de flou (non bloquant)
    let blurWarning: string | null = null;
    try {
      const blurResult = await detectBlur(buffer);
      if (blurResult.isBlurry && blurResult.message) {
        blurWarning = `${file.name} : ${blurResult.message}`;
      }
    } catch { /* ignore */ }

    // Upload vers R2
    const { key } = await uploadOriginalPhoto(buffer, file.type, file.name, session.user.id, jobId);

    // Pré-générer la version 2048px envoyée à Gemini (mêmes réglages exacts que
    // le pipeline : qualité identique garantie). Le serveur a déjà le buffer en
    // main → le pipeline n'aura plus à retélécharger l'original (jusqu'à 50 Mo)
    // ni à le redimensionner sur le chemin chaud. Non-bloquant : en cas d'échec
    // (ex: HEIC non décodable par sharp), le pipeline retombe sur l'original.
    try {
      const rendition = await resizeIfLarger(buffer, GEMINI_INPUT_MAX_EDGE);
      if (rendition !== buffer) {
        await uploadToR2(renditionKeyFor(key), rendition, "image/jpeg");
      }
    } catch (e) {
      console.warn(`Rendition 2048px non générée pour ${key} (fallback original):`, e);
    }

    // Récupérer l'instruction depuis le job si pas fournie dans la requête
    let photoInstruction = instruction;
    if (!photoInstruction && job.subOption) {
      try {
        const instructions = JSON.parse(job.subOption);
        if (Array.isArray(instructions)) {
          photoInstruction = instructions[job._count.photos] || null;
        }
      } catch { /* subOption n'est pas du JSON — l'utiliser tel quel */
        photoInstruction = job.subOption;
      }
    }

    // Créer le record photo
    const photo = await prisma.processedPhoto.create({
      data: {
        jobId,
        originalKey: key,
        fileName: file.name,
        fileSizeOriginal: file.size,
        instruction: photoInstruction,
        platformId,
        status: "PENDING",
      },
    });

    // Compter combien de photos sont maintenant uploadées
    const uploadedCount = job._count.photos + 1;
    const allUploaded = uploadedCount >= job.photoCount;

    // Démarrage eager : dès la 1ère photo en place, le pipeline démarre et
    // traite au fil des arrivées — la 1ère photo revient ~30-60s plus tôt.
    // Publié dans la file persistante (pg-boss) plutôt qu'en fire-and-forget :
    // le claim atomique PENDING→PROCESSING dans processJob + la policy
    // "stately" (1 message max par jobId) garantissent un seul runner même si
    // /api/process est aussi appelé en fin d'upload.
    if (job.status === "PENDING") {
      enqueueProcessJob(jobId).catch((err) =>
        console.error(`Eager processing start failed for job ${jobId}:`, err)
      );
    }

    return NextResponse.json({
      photoId: photo.id,
      uploadedCount,
      allUploaded,
      blurWarning,
    }, { status: 201 });
  } catch (error) {
    console.error(`Photo upload error for job ${jobId}:`, error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload de la photo." },
      { status: 500 }
    );
  }
}
