import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { JobStatus, type Preset } from "@prisma/client";
import { uploadProcessedPhoto } from "@/services/storage";
import { refundCredits } from "@/services/credits";
import { getSignedDownloadUrl } from "@/lib/r2";
import { retouchPhoto, generateSeoAndScore, type PhotoSeoResult } from "@/lib/gemini";
import { applyWatermark } from "@/services/watermark";
import { injectExifMetadata } from "@/services/processing/exif";
import { cropToPlatform } from "@/services/processing/platform-crop";
import { AGENTS } from "@/config/agents";
import { FREE_SIGNUP_CREDITS } from "@/config/plans";

// Pre-resize inputs sent to Gemini: smaller payload = faster model processing.
// 2048px keeps enough source detail for Gemini's understanding step (critical
// for fidelity on complex scenes — pushing lower visibly degraded output sharpness
// per user feedback). Still ~3-4x smaller than raw 4K phone photos.
const GEMINI_INPUT_MAX_EDGE = 2048;

// SEO/Score model only needs to *understand* the photo, not regenerate it.
// 768px is plenty for accurate classification and shaves another ~30% off
// the background enrichment latency vs sending the full-size processed image.
const SEO_INPUT_MAX_EDGE = 768;

// Adaptive concurrency: small batches stay at 3, larger batches push more.
// Capped at 8 to avoid hitting Gemini per-minute rate limits.
function computeConcurrency(photoCount: number): number {
  if (photoCount <= 1) return 1;
  return Math.min(8, Math.max(3, Math.ceil(photoCount / 2)));
}

/**
 * Traite toutes les photos d'un job via Gemini IA.
 */
export async function processJob(jobId: string): Promise<void> {
  const job = await prisma.processingJob.findUnique({
    where: { id: jobId },
    include: { photos: true, user: true },
  });

  if (!job) throw new Error(`Job ${jobId} non trouve`);
  if (job.status !== JobStatus.PENDING) return;

  let alreadyRefundedCount = 0;
  try {
    await prisma.processingJob.update({
      where: { id: jobId },
      data: { status: JobStatus.PROCESSING },
    });

    const agent = AGENTS[job.preset];
    const systemPrompt = agent?.systemPrompt ?? "You are a professional photo editor. Perform the requested edits with photorealistic, professional quality.";
    const isSubscribed = job.user?.isSubscribed === true || job.user?.role === "ADMIN";

    let completedBefore = 0;
    if (!isSubscribed) {
      completedBefore = await prisma.processedPhoto.count({
        where: {
          job: { userId: job.userId },
          status: JobStatus.COMPLETED,
        },
      });
    }

    const CONCURRENCY = computeConcurrency(job.photos.length);
    let failedCount = 0;
    let successCount = 0;

    for (let i = 0; i < job.photos.length; i += CONCURRENCY) {
      const batch = job.photos.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map((photo, idxInBatch) => {
          const globalIndex = completedBefore + i + idxInBatch;
          const applyWm = !isSubscribed && globalIndex < FREE_SIGNUP_CREDITS;
          return processOnePhoto(photo, job, systemPrompt, applyWm, job.user?.businessCity);
        })
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled" && result.value.success) {
          successCount++;
        } else {
          failedCount++;
          if (result.status === "rejected") {
            await refundCredits(job.userId, 1, job.id).catch(console.error);
          }
          alreadyRefundedCount++;
        }
      }
    }

    const finalStatus =
      failedCount === 0
        ? JobStatus.COMPLETED
        : successCount === 0
        ? JobStatus.FAILED
        : JobStatus.COMPLETED;

    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        errorMsg: failedCount > 0 ? `${failedCount} photo(s) en echec` : null,
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

    const unprocessed = await prisma.processedPhoto.count({
      where: { jobId, status: { not: JobStatus.COMPLETED } },
    });
    const toRefund = Math.max(0, unprocessed - alreadyRefundedCount);
    if (toRefund > 0) {
      await refundCredits(job.userId, toRefund, jobId).catch(console.error);
    }
  }
}

/**
 * Resize down to a max long edge if needed. Returns same buffer if already small enough.
 */
async function resizeIfLarger(buffer: Buffer, maxEdge: number, jpegQuality = 92): Promise<Buffer> {
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
  userLocation?: string | null
): Promise<{ success: boolean }> {
  try {
    await prisma.processedPhoto.update({
      where: { id: photo.id },
      data: { status: JobStatus.PROCESSING },
    });

    const originalUrl = await getSignedDownloadUrl(photo.originalKey);
    const response = await fetch(originalUrl);
    if (!response.ok) throw new Error("Impossible de telecharger l'original");
    const rawBuffer = Buffer.from(await response.arrayBuffer());

    const inputBuffer = await resizeIfLarger(rawBuffer, GEMINI_INPUT_MAX_EDGE);

    const instruction = photo.instruction || job.subOption || "Improve the overall quality of the photo: brightness, contrast, sharpness, colors.";

    const imageBase64 = inputBuffer.toString("base64");
    let outputBuffer = await retouchPhoto(imageBase64, instruction, systemPrompt);

    outputBuffer = await cropToPlatform(outputBuffer, job.preset, photo.platformId);

    if (shouldWatermark) {
      outputBuffer = await applyWatermark(outputBuffer);
    }

    const photoUuid = photo.originalKey.split("/").pop()?.split(".")[0] ?? photo.id;

    // FIRE SEO + UPLOAD IN PARALLEL: the Gemini SEO call (~5-15s) is much longer than
    // the R2 upload (~300-500ms), so launching them together saves the upload time
    // off the background enrichment path.
    const seoCallPromise = callSeoForBackground(outputBuffer, job.preset, userLocation);

    const processedKey = await uploadProcessedPhoto(
      outputBuffer,
      job.userId,
      job.id,
      photoUuid
    );

    await prisma.processedPhoto.update({
      where: { id: photo.id },
      data: {
        processedKey,
        fileSizeProcessed: outputBuffer.length,
        status: JobStatus.COMPLETED,
      },
    });

    // Once SEO returns, persist + re-upload EXIF-enriched buffer (background, non-blocking).
    seoCallPromise
      .then((seoResult) =>
        persistSeoResult(photo.id, outputBuffer, seoResult, photoUuid, job.userId, job.id, job.preset)
      )
      .catch((e) => console.error(`SEO persist error for photo ${photo.id}:`, e));

    return { success: true };
  } catch (error) {
    console.error(`Erreur traitement photo ${photo.id}:`, error);

    await prisma.processedPhoto.update({
      where: { id: photo.id },
      data: { status: JobStatus.FAILED },
    }).catch(console.error);

    await refundCredits(job.userId, 1, job.id).catch(console.error);
    return { success: false };
  }
}

/**
 * Call Gemini SEO + Score on a downscaled copy (faster, cheaper, same accuracy
 * since the model only needs to understand the scene).
 */
async function callSeoForBackground(
  outputBuffer: Buffer,
  preset: string,
  userLocation?: string | null
): Promise<{ seo: PhotoSeoResult; score: number; report: string }> {
  const small = await resizeIfLarger(outputBuffer, SEO_INPUT_MAX_EDGE, 80);
  const base64 = small.toString("base64");
  return generateSeoAndScore(base64, preset as Preset, userLocation ?? undefined);
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
  preset: string
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
        schemaJsonLd: seo.seoSchemaJson,
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
          seoSchemaJson: seo.seoSchemaJson || null,
          photoScore: score || null,
          photoScoreReport: report || null,
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
      seoSchemaJson: seo.seoSchemaJson || null,
      photoScore: score || null,
      photoScoreReport: report || null,
    },
  });
}
