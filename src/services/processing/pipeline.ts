import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { JobStatus, type Preset } from "@prisma/client";
import { uploadProcessedPhoto } from "@/services/storage";
import { refundJobCredits } from "@/services/credits";
import { getSignedDownloadUrl } from "@/lib/r2";
import { generateSeoAndScore, generatePhotoSEO, type PhotoSeoResult } from "@/lib/gemini";
import { editImage } from "@/services/providers";
import { upscaleIfNeeded } from "@/services/providers/upscale";
import { postEnhance } from "@/services/processing/post-enhance";

// Instructions par défaut par preset — RÈGLE DE SÉCURITÉ apprise en prod :
// ne JAMAIS affirmer l'existence d'objets ("make the sky blue", "pool
// crystal clear", "the property") — sur une photo qui ne les contient pas
// (forêt, terrain nu), Kontext littéral peut les INVENTER (constaté : maison
// générée dans une forêt). Le défaut = rehaussement lumière/couleur/netteté
// UNIQUEMENT. Les éditions d'objets (piscine, ciel, voiture…) viennent des
// instructions EXPLICITES de l'utilisateur (suggestions cliquables).
// Enrichi 2026-08-18 : la version précédente (générique "adjust ONLY light,
// color and sharpness" pour les 5 presets) datait du fix anti-hallucination
// de juillet, calibré pour Kontext — un éditeur littéral qui inventait des
// structures à partir d'assertions d'objet ("make the sky blue" sur une photo
// sans ciel visible → maison générée en forêt). Le modèle primaire est
// maintenant Nano Banana 2, bien plus fiable sur la compréhension de scène ;
// la prudence maximale n'était plus justifiée et coûtait tout le sens métier
// de chaque preset (fond blanc e-commerce, remplacement de ciel immo...),
// jamais transmis au modèle par défaut. Retours beta testeurs directement
// visés : "résultat ne correspond pas à la demande", "manque de qualité".
// Toujours SANS assertion d'existence (langage conditionnel "if X is
// visible") — même discipline que la clause anti-invention ajoutée
// automatiquement en aval par buildFalPrompt().
const DEFAULT_INSTRUCTIONS: Record<string, string> = {
  AIRBNB:
    "Professionally enhance this real estate photo for a premium listing: significantly brighter and more luminous exposure, corrected white balance, natural vivid colors, crisp sharp details, corrected vertical perspective (straighten walls, doors and windows if tilted). If a sky is visible and looks dull or overcast, gently enhance its natural blue tone. If grass or plants are visible and look dry, gently enhance their natural green. Adjust only light, color, sharpness and perspective — do not alter the structure of the scene.",
  IMMOBILIER:
    "Professionally enhance this real estate photo for a premium listing: significantly brighter and more luminous exposure, corrected white balance, natural vivid colors, crisp sharp details, corrected vertical perspective (straighten walls, doors and windows if tilted). If a sky is visible and looks dull or overcast, gently enhance its natural blue tone. If grass or plants are visible and look dry, gently enhance their natural green. Adjust only light, color, sharpness and perspective — do not alter the structure of the scene.",
  INSTAGRAM:
    "Professionally enhance this photo for social media: vibrant cinematic color grade, punchy contrast, crisp sharp details, brighter balanced exposure. If a person's skin is visible, apply natural subtle skin smoothing while preserving texture and pores. If the background is visible and busy, you may gently soften it with a bokeh-style blur while keeping the main subject perfectly sharp. Adjust only light, color, sharpness and background blur.",
  VINTED:
    "Professionally enhance this product photo for resale (Vinted, Leboncoin, marketplace): replace the background with a clean neutral background (white, light beige or gray), product perfectly centered, honest and trustworthy presentation. Bright clean lighting, sharp details, true-to-life accurate colors, smooth out any wrinkles or creases on fabric. Keep the product exactly as it is including any visible wear — do not hide defects or alter its shape, color or condition.",
  SHOPIFY:
    "Professionally enhance this product photo for e-commerce: replace the background with a clean pure white (#FFFFFF) studio background, product perfectly centered with even margins, soft natural drop shadow beneath it. Bright sharp studio lighting, true-to-life accurate colors, smooth out any wrinkles or creases on fabric. Keep the product itself exactly as it is — do not alter its shape, color or size.",
};
const GENERIC_INSTRUCTION =
  "Professionally enhance this photo: brighter balanced exposure, natural vivid colors, crisp details. Adjust ONLY light, color and sharpness.";
import { applyWatermark } from "@/services/watermark";
import { injectExifMetadata } from "@/services/processing/exif";
import { cropToPlatform } from "@/services/processing/platform-crop";
import { AGENTS } from "@/config/agents";
import { getPlatformById } from "@/config/platforms";

// Pre-resize inputs sent to Gemini: smaller payload = faster model processing.
// 2048px keeps enough source detail for Gemini's understanding step (critical
// for fidelity on complex scenes — pushing lower visibly degraded output sharpness
// per user feedback). Still ~3-4x smaller than raw 4K phone photos.
// Exported: the upload route pre-generates this rendition at upload time.
export const GEMINI_INPUT_MAX_EDGE = 2048;

// SEO/Score model only needs to *understand* the photo, not regenerate it.
// 768px is plenty for accurate classification and shaves another ~30% off
// the background enrichment latency vs sending the full-size processed image.
const SEO_INPUT_MAX_EDGE = 768;

// Adaptive concurrency, capped at 8 to stay under Gemini per-minute rate limits.
// Full parallelism below the cap: a 4-photo job runs its 4 photos at once
// (the previous max(3, ceil(n/2)) made a 4-photo job run 3+1 → ~40% slower).
// Exported: the job status API uses it to compute a realistic ETA.
export function computeConcurrency(photoCount: number): number {
  return Math.max(1, Math.min(8, photoCount));
}

// Streaming pipeline: processing starts as soon as the FIRST photo is uploaded,
// while the rest of the batch is still uploading. If no new photo shows up for
// this long while some are still expected, we assume the client abandoned the
// upload and stop waiting (stale-job recovery + end-of-job refund cover the rest).
// Note: each upload request is capped at 60s server-side (maxDuration), so a
// healthy client can never be silent longer than ~60s between two photos.
const UPLOAD_STALL_MS = 180_000;

/** Clé R2 de la version 2048px pré-générée à l'upload (voir photos/route.ts). */
export function renditionKeyFor(originalKey: string): string {
  return `${originalKey}.g2048.jpg`;
}

type PhotoRow = {
  id: string;
  originalKey: string;
  instruction: string | null;
  platformId: string | null;
  fileName: string;
};

/**
 * Traite toutes les photos d'un job via Gemini IA.
 * Démarre dès la première photo uploadée (streaming) : les workers réclament
 * les photos au fil de leur arrivée en DB au lieu d'attendre le batch complet.
 */
export async function processJob(jobId: string): Promise<void> {
  // Claim atomique PENDING→PROCESSING : un seul runner par job, même si le
  // pipeline est déclenché à la fois par l'upload de la 1ère photo (eager)
  // et par /api/process en fin d'upload (filet de sécurité).
  const claimedJob = await prisma.processingJob.updateMany({
    where: { id: jobId, status: JobStatus.PENDING },
    data: { status: JobStatus.PROCESSING },
  });
  if (claimedJob.count === 0) return; // déjà en cours ou terminé

  const job = await prisma.processingJob.findUnique({
    where: { id: jobId },
    include: { user: true },
  });
  if (!job) throw new Error(`Job ${jobId} non trouve`);

  try {
    const agent = AGENTS[job.preset];
    const systemPrompt = agent?.systemPrompt ?? "You are a professional photo editor. Perform the requested edits with photorealistic, professional quality.";
    const isAdmin = job.user?.role === "ADMIN";
    const isSubscribed = job.user?.isSubscribed === true || isAdmin;
    // Watermark logo Pictaura sur TOUTES les photos des comptes non-premium
    // (alignement avec la promesse pricing : seuls les abonnés livrent sans badge).
    const applyWm = !isSubscribed;
    // Score qualité (/10) et JSON-LD schema.org : réservés aux plans Pro et
    // Business conformément à la grille tarifaire.
    const isPro = isAdmin || job.user?.planId === "pro" || job.user?.planId === "business";

    const CONCURRENCY = computeConcurrency(job.photoCount);
    let failedCount = 0;
    let successCount = 0;
    const claimedIds = new Set<string>();
    let lastPhotoSeenAt = Date.now();
    // Les claims sont sérialisés via une chaîne de promesses : deux workers ne
    // peuvent jamais récupérer la même photo (JS mono-thread entre awaits,
    // mais deux findFirst concurrents retourneraient la même ligne).
    let claimChain: Promise<unknown> = Promise.resolve();

    const claimNext = (): Promise<PhotoRow | "wait" | null> => {
      const p = claimChain.then(async () => {
        const photo = await prisma.processedPhoto.findFirst({
          where: {
            jobId,
            status: JobStatus.PENDING,
            ...(claimedIds.size > 0 ? { id: { notIn: [...claimedIds] } } : {}),
          },
          orderBy: { createdAt: "asc" },
          select: { id: true, originalKey: true, instruction: true, platformId: true, fileName: true },
        });
        if (photo) {
          claimedIds.add(photo.id);
          lastPhotoSeenAt = Date.now();
          return photo;
        }
        if (claimedIds.size >= job.photoCount) return null; // tout est dispatché
        if (Date.now() - lastPhotoSeenAt > UPLOAD_STALL_MS) return null; // upload abandonné
        return "wait" as const; // photos encore en cours d'upload → patienter
      });
      claimChain = p.catch(() => {});
      return p;
    };

    const worker = async (): Promise<void> => {
      while (true) {
        const next = await claimNext();
        if (next === null) return;
        if (next === "wait") {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        try {
          const result = await processOnePhoto(next, job, systemPrompt, applyWm, isPro, job.user?.businessCity);
          if (result.success) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (err) {
          // processOnePhoto catches internally; this is a belt-and-braces path.
          console.error(`Worker crash on photo ${next.id}:`, err);
          failedCount++;
          await refundJobCredits(job.id, 1, "Photo en échec (crash worker)").catch(console.error);
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    // Photos jamais uploadées (client parti en plein upload) : crédits déduits
    // à la création du job mais jamais consommés → remboursement.
    const createdCount = await prisma.processedPhoto.count({ where: { jobId } });
    const missingCount = Math.max(0, job.photoCount - createdCount);
    if (missingCount > 0) {
      await refundJobCredits(jobId, missingCount, "Photos jamais uploadées").catch(console.error);
    }

    const anyFailure = failedCount > 0 || missingCount > 0;
    const finalStatus =
      successCount === 0 && anyFailure ? JobStatus.FAILED : JobStatus.COMPLETED;

    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        errorMsg: anyFailure
          ? `${failedCount + missingCount} photo(s) en echec — credits rembourses`
          : null,
      },
    });
  } catch (error) {
    console.error(`Job ${jobId} crashed:`, error);
    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        errorMsg: error instanceof Error ? error.message : "Erreur interne",
      },
    }).catch(console.error);

    // Le ledger recalcule ce qui reste réellement dû (photoCount - déjà
    // remboursé - COMPLETED) — sur-demander photoCount entier est sans risque,
    // qu'il reste 0 ou N crédits à rendre après un crash à n'importe quel stade.
    await refundJobCredits(jobId, job.photoCount, "Job en erreur — traitement interrompu").catch(console.error);
  }
}

/**
 * Resize down to a max long edge if needed. Returns same buffer if already small enough.
 * Exported: the upload route uses the exact same transform to pre-stage the
 * Gemini rendition — guaranteed identical quality to the on-the-fly path.
 */
export async function resizeIfLarger(buffer: Buffer, maxEdge: number, jpegQuality = 92): Promise<Buffer> {
  try {
    const meta = await sharp(buffer).metadata();
    const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (longEdge === 0 || longEdge <= maxEdge) return buffer;
    return await sharp(buffer)
      .rotate()
      .resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: jpegQuality, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.warn(`resize to ${maxEdge}px failed, returning original:`, err);
    return buffer;
  }
}

/**
 * Process a single photo: retouch → upload → update DB.
 * SEO/Score Gemini call is launched in parallel with the R2 upload to save ~300-500ms
 * of wall time per photo on the user-visible path.
 */
async function processOnePhoto(
  photo: { id: string; originalKey: string; instruction: string | null; platformId: string | null; fileName: string },
  job: { id: string; userId: string; preset: string; subOption: string | null },
  systemPrompt: string,
  shouldWatermark: boolean,
  isPro: boolean,
  userLocation?: string | null
): Promise<{ success: boolean }> {
  const startedAt = Date.now();
  try {
    await prisma.processedPhoto.update({
      where: { id: photo.id },
      data: { status: JobStatus.PROCESSING },
    });

    // Version 2048px pré-générée à l'upload : ~500 Ko à télécharger au lieu de
    // l'original (jusqu'à 50 Mo) + zéro resize sur le chemin chaud. Fallback
    // transparent sur l'original pour les photos d'avant cette optimisation.
    let inputBuffer: Buffer | null = null;
    try {
      const renditionUrl = await getSignedDownloadUrl(renditionKeyFor(photo.originalKey));
      const renditionRes = await fetch(renditionUrl);
      if (renditionRes.ok) {
        inputBuffer = Buffer.from(await renditionRes.arrayBuffer());
      }
    } catch { /* fallback original */ }

    if (!inputBuffer) {
      const originalUrl = await getSignedDownloadUrl(photo.originalKey);
      const response = await fetch(originalUrl);
      if (!response.ok) throw new Error("Impossible de telecharger l'original");
      const rawBuffer = Buffer.from(await response.arrayBuffer());
      inputBuffer = await resizeIfLarger(rawBuffer, GEMINI_INPUT_MAX_EDGE);
    }

    const instruction =
      photo.instruction || DEFAULT_INSTRUCTIONS[job.preset] || GENERIC_INSTRUCTION;

    // Ratio cible de la plateforme choisie, si applicable — laisse le modèle
    // composer directement au bon format (cf. providers/fal-provider.ts)
    // plutôt que de recadrer à l'aveugle après coup en Sharp.
    const platform = photo.platformId ? getPlatformById(job.preset, photo.platformId) : undefined;

    // Palier qualité par plan (décision Esteban 2026-08-19, identique sur les
    // 3 presets) : Starter = 1K (défaut fal, omis), Pro/Business = 2K natif —
    // plus net qu'un 1K + upscale ESRGAN, et évite l'upscale dans la foulée
    // pour ces comptes (upscaleIfNeeded ne se déclenche que sous 1920px).
    const resolution = isPro ? "2K" : undefined;

    // Couche provider : primaire + circuit breaker + secours (cf. providers/).
    // Le provider rend l'image brute ; crop → watermark → EXIF restent ici,
    // identiques quel que soit le modèle (pipeline provider-agnostique).
    const imageBase64 = inputBuffer.toString("base64");
    const edited = await editImage({ imageBase64, instruction, systemPrompt, aspectRatio: platform?.ratio, resolution });
    let outputBuffer = edited.buffer;

    // Rehaussement photométrique derrière KONTEXT uniquement (éditeur d'objets
    // à biais de préservation → rend "sombre/terne" en global). Les modèles de
    // la famille Gemini/Nano Banana rehaussent NATIVEMENT — un lift en plus
    // les surcuirait. Décision par MODÈLE, pas par provider (NB2 tourne via fal).
    if (edited.model.includes("kontext")) {
      outputBuffer = await postEnhance(outputBuffer, job.preset);
    }

    // Upscale ×2 si la sortie provider est sous le standard immo (1920px) —
    // Kontext sort ~1 Mpx. Non-bloquant : échec = image originale conservée.
    outputBuffer = await upscaleIfNeeded(outputBuffer);

    outputBuffer = await cropToPlatform(outputBuffer, job.preset, photo.platformId);

    if (shouldWatermark) {
      outputBuffer = await applyWatermark(outputBuffer);
    }

    const photoUuid = photo.originalKey.split("/").pop()?.split(".")[0] ?? photo.id;

    // FIRE SEO + UPLOAD IN PARALLEL: the Gemini SEO call (~5-15s) is much longer than
    // the R2 upload (~300-500ms), so launching them together saves the upload time
    // off the background enrichment path.
    const seoCallPromise = callSeoForBackground(outputBuffer, job.preset, isPro, userLocation);

    const processedKey = await uploadProcessedPhoto(
      outputBuffer,
      job.userId,
      job.id,
      photoUuid
    );

    const processingMs = Date.now() - startedAt;
    await prisma.processedPhoto.update({
      where: { id: photo.id },
      data: {
        processedKey,
        fileSizeProcessed: outputBuffer.length,
        status: JobStatus.COMPLETED,
        processingMs,
      },
    });
    console.log(`Photo ${photo.id} processed in ${(processingMs / 1000).toFixed(1)}s`);

    // Once SEO returns, persist + re-upload EXIF-enriched buffer (background, non-blocking).
    seoCallPromise
      .then((seoResult) =>
        persistSeoResult(photo.id, outputBuffer, seoResult, photoUuid, job.userId, job.id, job.preset, isPro)
      )
      .catch((e) => console.error(`SEO persist error for photo ${photo.id}:`, e));

    return { success: true };
  } catch (error) {
    console.error(`Erreur traitement photo ${photo.id}:`, error);

    await prisma.processedPhoto.update({
      where: { id: photo.id },
      data: {
        status: JobStatus.FAILED,
        // Support client : trace du motif d'échec ("pourquoi ma photo a échoué ?")
        failReason: error instanceof Error ? error.message.slice(0, 300) : "Erreur inconnue",
      },
    }).catch(console.error);

    await refundJobCredits(job.id, 1, "Photo en échec").catch(console.error);
    return { success: false };
  }
}

/**
 * Call Gemini SEO (+ Score si plan Pro/Business) on a downscaled copy.
 * Le score qualité /10 est une feature Pro : on économise l'appel Gemini
 * correspondant pour les comptes Free/Starter.
 */
async function callSeoForBackground(
  outputBuffer: Buffer,
  preset: string,
  isPro: boolean,
  userLocation?: string | null
): Promise<{ seo: PhotoSeoResult; score: number; report: string }> {
  const small = await resizeIfLarger(outputBuffer, SEO_INPUT_MAX_EDGE, 80);
  const base64 = small.toString("base64");
  if (isPro) {
    return generateSeoAndScore(base64, preset as Preset, userLocation ?? undefined);
  }
  const seo = await generatePhotoSEO(base64, preset as Preset, userLocation ?? undefined);
  return { seo, score: 0, report: "" };
}

/**
 * Inject EXIF/XMP into the final processed buffer, re-upload over the same R2 key,
 * and persist the SEO+score fields to the DB.
 */
async function persistSeoResult(
  photoId: string,
  outputBuffer: Buffer,
  result: { seo: PhotoSeoResult; score: number; report: string },
  photoUuid: string,
  userId: string,
  jobId: string,
  preset: string,
  isPro: boolean
): Promise<void> {
  const { seo, score, report } = result;

  if (seo.altText || seo.seoFileName) {
    try {
      const enrichedBuffer = await injectExifMetadata(outputBuffer, {
        altText: seo.altText,
        seoFileName: seo.seoFileName,
        description: seo.description,
        keywords: seo.keywords,
        metaTitle: seo.metaTitle,
        hashtags: seo.hashtags,
        // JSON-LD schema.org : feature Pro/Business uniquement (grille tarifaire)
        schemaJsonLd: isPro ? seo.seoSchemaJson : "",
        preset,
      });

      const newKey = await uploadProcessedPhoto(enrichedBuffer, userId, jobId, photoUuid);
      await prisma.processedPhoto.update({
        where: { id: photoId },
        data: {
          processedKey: newKey,
          fileSizeProcessed: enrichedBuffer.length,
          seoAltText: seo.altText || null,
          seoFileName: seo.seoFileName || null,
          seoDescription: seo.description || null,
          seoKeywords: seo.keywords || null,
          seoMetaTitle: seo.metaTitle || null,
          seoHashtags: seo.hashtags || null,
          // Features Pro non persistées pour les autres plans : le ZIP, les
          // headers HTTP et l'API lisent la DB → gating automatique partout.
          seoSchemaJson: isPro ? seo.seoSchemaJson || null : null,
          photoScore: isPro ? score || null : null,
          photoScoreReport: isPro ? report || null : null,
        },
      });
      return;
    } catch (e) {
      console.error("EXIF injection error (non-blocking):", e);
    }
  }

  // Fallback: persist SEO fields without re-upload
  await prisma.processedPhoto.update({
    where: { id: photoId },
    data: {
      seoAltText: seo.altText || null,
      seoFileName: seo.seoFileName || null,
      seoDescription: seo.description || null,
      seoKeywords: seo.keywords || null,
      seoMetaTitle: seo.metaTitle || null,
      seoHashtags: seo.hashtags || null,
      seoSchemaJson: isPro ? seo.seoSchemaJson || null : null,
      photoScore: isPro ? score || null : null,
      photoScoreReport: isPro ? report || null : null,
    },
  });
}
