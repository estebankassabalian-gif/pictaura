import { prisma } from "@/lib/prisma";
import { JobStatus, type Preset } from "@prisma/client";
import { uploadProcessedPhoto } from "@/services/storage";
import { refundCredits } from "@/services/credits";
import { getSignedDownloadUrl } from "@/lib/r2";
import { retouchPhoto, generatePhotoSEO, scorePhoto } from "@/lib/gemini";
import { applyWatermark } from "@/services/watermark";
import { injectExifMetadata } from "@/services/processing/exif";
import { cropToPlatform } from "@/services/processing/platform-crop";
import { AGENTS } from "@/config/agents";
import { FREE_SIGNUP_CREDITS } from "@/config/plans";

// Process up to 3 photos concurrently — Gemini handles parallel requests well
const CONCURRENCY = 3;

/**
 * Traite toutes les photos d'un job via Gemini IA.
 * Photos are processed in batches of CONCURRENCY for speed.
 * SEO/Score runs in the background (non-blocking) to avoid slowing down the pipeline.
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

    // Watermark uniquement sur les FREE_SIGNUP_CREDITS (5) premières retouches d'un compte.
    // Dès que l'utilisateur a traité 5 photos ou qu'il s'abonne, le watermark disparaît.
    let completedBefore = 0;
    if (!isSubscribed) {
      completedBefore = await prisma.processedPhoto.count({
        where: {
          job: { userId: job.userId },
          status: JobStatus.COMPLETED,
        },
      });
    }

    let failedCount = 0;
    let successCount = 0;

    // Process photos in batches of CONCURRENCY
    for (let i = 0; i < job.photos.length; i += CONCURRENCY) {
      const batch = job.photos.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map((photo, idxInBatch) => {
          // Index global dans le job (sert à calculer si on est dans la fenêtre free)
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
          // processOnePhoto handles its own refund internally, but if the promise
          // rejected unexpectedly (shouldn't happen), refund manually
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
 * Process a single photo: retouch → upload → update DB.
 * SEO + Score run in the background (non-blocking) to avoid delaying the next photo.
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

    // Download original from R2
    const originalUrl = await getSignedDownloadUrl(photo.originalKey);
    const response = await fetch(originalUrl);
    if (!response.ok) throw new Error("Impossible de telecharger l'original");
    const inputBuffer = Buffer.from(await response.arrayBuffer());

    const instruction = photo.instruction || job.subOption || "Improve the overall quality of the photo: brightness, contrast, sharpness, colors.";

    // Retouch via Gemini
    const imageBase64 = inputBuffer.toString("base64");
    let outputBuffer = await retouchPhoto(imageBase64, instruction, systemPrompt);

    // Force exact platform dimensions (Gemini ne respecte pas toujours le ratio demandé).
    // No-op si pas de plateforme sélectionnée.
    outputBuffer = await cropToPlatform(outputBuffer, job.preset, photo.platformId);

    // Watermark uniquement pour les 5 retouches offertes à l'inscription
    if (shouldWatermark) {
      outputBuffer = await applyWatermark(outputBuffer);
    }

    // Upload result immediately (don't wait for SEO)
    const photoUuid = photo.originalKey.split("/").pop()?.split(".")[0] ?? photo.id;
    const processedKey = await uploadProcessedPhoto(
      outputBuffer,
      job.userId,
      job.id,
      photoUuid
    );

    // Mark COMPLETED immediately so the frontend sees progress fast
    await prisma.processedPhoto.update({
      where: { id: photo.id },
      data: {
        processedKey,
        fileSizeProcessed: outputBuffer.length,
        status: JobStatus.COMPLETED,
      },
    });

    // SEO + Score run in background (non-blocking)
    // They update the DB when done — the user sees their photos instantly
    runSeoAndScore(photo.id, outputBuffer, job.preset, userLocation ?? undefined).catch((e) =>
      console.error(`SEO/score background error for photo ${photo.id}:`, e)
    );

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
 * Run SEO generation + photo scoring in background.
 * Updates the DB when done. Non-blocking.
 */
async function runSeoAndScore(
  photoId: string,
  outputBuffer: Buffer,
  preset: string,
  userLocation?: string
): Promise<void> {
  let seoData = {
    altText: "", seoFileName: "", description: "",
    keywords: "", metaTitle: "", hashtags: "", seoSchemaJson: "",
  };
  let scoreData = { score: 0, report: "" };

  try {
    const outputBase64 = outputBuffer.toString("base64");
    [seoData, scoreData] = await Promise.all([
      generatePhotoSEO(outputBase64, preset as Preset, userLocation),
      scorePhoto(outputBase64, preset as Preset),
    ]);
  } catch (e) {
    console.error("SEO/score error (non-blocking):", e);
    return;
  }

  // Inject EXIF metadata into stored file
  if (seoData.altText || seoData.seoFileName) {
    try {
      const enrichedBuffer = await injectExifMetadata(outputBuffer, {
        altText: seoData.altText,
        seoFileName: seoData.seoFileName,
        description: seoData.description,
        keywords: seoData.keywords,
        preset,
      });

      // Re-upload with EXIF — get the current processedKey
      const photo = await prisma.processedPhoto.findUnique({
        where: { id: photoId },
        select: { processedKey: true, job: { select: { userId: true, id: true } } },
      });
      if (photo?.processedKey) {
        const photoUuid = photo.processedKey.split("/").pop()?.split(".")[0] ?? photoId;
        const newKey = await uploadProcessedPhoto(
          enrichedBuffer,
          photo.job.userId,
          photo.job.id,
          photoUuid
        );
        // Update with EXIF-enriched key + SEO data
        await prisma.processedPhoto.update({
          where: { id: photoId },
          data: {
            processedKey: newKey,
            fileSizeProcessed: enrichedBuffer.length,
            seoAltText: seoData.altText || null,
            seoFileName: seoData.seoFileName || null,
            seoDescription: seoData.description || null,
            seoKeywords: seoData.keywords || null,
            seoMetaTitle: seoData.metaTitle || null,
            seoHashtags: seoData.hashtags || null,
            seoSchemaJson: seoData.seoSchemaJson || null,
            photoScore: scoreData.score || null,
            photoScoreReport: scoreData.report || null,
          },
        });
        return;
      }
    } catch (e) {
      console.error("EXIF injection error (non-blocking):", e);
    }
  }

  // Fallback: just update SEO fields without re-upload
  await prisma.processedPhoto.update({
    where: { id: photoId },
    data: {
      seoAltText: seoData.altText || null,
      seoFileName: seoData.seoFileName || null,
      seoDescription: seoData.description || null,
      seoKeywords: seoData.keywords || null,
      seoMetaTitle: seoData.metaTitle || null,
      seoHashtags: seoData.hashtags || null,
      seoSchemaJson: seoData.seoSchemaJson || null,
      photoScore: scoreData.score || null,
      photoScoreReport: scoreData.report || null,
    },
  });
}
