import { prisma } from "@/lib/prisma";
import { JobStatus } from "@prisma/client";
import { uploadProcessedPhoto } from "@/services/storage";
import { refundCredits } from "@/services/credits";
import { generatePhotoSEO, scorePhoto } from "@/lib/openai";
import { getSignedDownloadUrl } from "@/lib/r2";
import { sendJobCompletedEmail } from "@/lib/email";
import { retouchPhoto } from "@/lib/gemini";
import { applyWatermark } from "@/services/watermark";
import { injectExifMetadata } from "@/services/processing/exif";
import { AGENTS } from "@/config/agents";

// Process up to 2 photos concurrently to cut total time in half
const CONCURRENCY = 2;

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

    let failedCount = 0;
    let successCount = 0;

    // Process photos in batches of CONCURRENCY
    for (let i = 0; i < job.photos.length; i += CONCURRENCY) {
      const batch = job.photos.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map((photo) =>
          processOnePhoto(photo, job, systemPrompt, isSubscribed)
        )
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

    if (job.user?.email && job.user.name) {
      sendJobCompletedEmail({
        to: job.user.email,
        userName: job.user.name,
        preset: job.preset,
        photoCount: job.photos.length,
        jobId,
        successCount,
        failedCount,
      }).catch((err) => console.error("Email notification error:", err));
    }
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
  photo: { id: string; originalKey: string; instruction: string | null; fileName: string },
  job: { id: string; userId: string; preset: string; subOption: string | null },
  systemPrompt: string,
  isSubscribed: boolean
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

    // Apply watermark for non-subscribed users
    if (!isSubscribed) {
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
    runSeoAndScore(photo.id, outputBuffer, job.preset).catch((e) =>
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
  preset: string
): Promise<void> {
  let seoData = {
    altText: "", seoFileName: "", description: "",
    keywords: "", metaTitle: "", hashtags: "", seoSchemaJson: "",
  };
  let scoreData = { score: 0, report: "" };

  try {
    const outputBase64 = outputBuffer.toString("base64");
    [seoData, scoreData] = await Promise.all([
      generatePhotoSEO(outputBase64, preset as any),
      scorePhoto(outputBase64, preset as any),
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
