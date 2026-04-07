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

/**
 * Traite toutes les photos d'un job via Gemini IA.
 * Le champ subOption contient les instructions de retouche.
 * Applique un watermark si l'utilisateur n'est pas abonne.
 */
export async function processJob(jobId: string): Promise<void> {
  const job = await prisma.processingJob.findUnique({
    where: { id: jobId },
    include: { photos: true, user: true },
  });

  if (!job) throw new Error(`Job ${jobId} non trouve`);
  if (job.status !== JobStatus.PENDING) return;

  try {
    await prisma.processingJob.update({
      where: { id: jobId },
      data: { status: JobStatus.PROCESSING },
    });

    // Resolve the agent config for this preset
    const agent = AGENTS[job.preset];
    const systemPrompt = agent?.systemPrompt ?? "You are a professional photo editor. Perform the requested edits with photorealistic, professional quality.";

    // Check subscription status for watermark (ADMIN = always subscribed)
    const isSubscribed = job.user?.isSubscribed === true || job.user?.role === "ADMIN";

    let failedCount = 0;
    let successCount = 0;

    // Process photos SEQUENTIALLY to avoid Gemini rate limits
    // Each photo takes ~30-40s — sequential is more reliable than concurrent batches
    for (const photo of job.photos) {
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

        // Per-photo instruction (priority) or fallback to job-level subOption
        const instruction = photo.instruction || job.subOption || "Improve the overall quality of the photo: brightness, contrast, sharpness, colors.";

        // Retouch via Gemini (has built-in retry with backoff)
        const imageBase64 = inputBuffer.toString("base64");
        let outputBuffer = await retouchPhoto(imageBase64, instruction, systemPrompt);

        // Apply watermark for non-subscribed users
        if (!isSubscribed) {
          outputBuffer = await applyWatermark(outputBuffer);
        }

        // SEO + Score (parallel, non-blocking) — AVANT upload pour injecter EXIF
        let seoData = {
          altText: "", seoFileName: "", description: "",
          keywords: "", metaTitle: "", hashtags: "", seoSchemaJson: "",
        };
        let scoreData = { score: 0, report: "" };

        try {
          const outputBase64 = outputBuffer.toString("base64");
          [seoData, scoreData] = await Promise.all([
            generatePhotoSEO(outputBase64, job.preset),
            scorePhoto(outputBase64, job.preset),
          ]);
        } catch (e) {
          console.error("SEO/score error (non-blocking):", e);
        }

        // Injecter les métadonnées SEO dans les EXIF AVANT upload
        if (seoData.altText || seoData.seoFileName) {
          outputBuffer = await injectExifMetadata(outputBuffer, {
            altText: seoData.altText,
            seoFileName: seoData.seoFileName,
            description: seoData.description,
            keywords: seoData.keywords,
            preset: job.preset,
          });
        }

        // Upload result (now includes EXIF metadata)
        const photoUuid = photo.originalKey.split("/").pop()?.split(".")[0] ?? photo.id;
        const processedKey = await uploadProcessedPhoto(
          outputBuffer,
          job.userId,
          jobId,
          photoUuid
        );

        await prisma.processedPhoto.update({
          where: { id: photo.id },
          data: {
            processedKey,
            fileSizeProcessed: outputBuffer.length,
            status: JobStatus.COMPLETED,
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

        successCount++;
      } catch (error) {
        console.error(`Erreur traitement photo ${photo.id}:`, error);

        await prisma.processedPhoto.update({
          where: { id: photo.id },
          data: { status: JobStatus.FAILED },
        }).catch(console.error);

        await refundCredits(job.userId, 1, jobId).catch(console.error);
        failedCount++;
      }

      // Small delay between photos to respect Gemini rate limits
      if (job.photos.indexOf(photo) < job.photos.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
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
    // Global catch — if processJob crashes before/during processing, mark job FAILED and refund all
    console.error(`Job ${jobId} crashed:`, error);
    await prisma.processingJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        errorMsg: error instanceof Error ? error.message : "Erreur interne",
      },
    }).catch(console.error);

    // Refund all unprocessed photos
    const unprocessed = await prisma.processedPhoto.count({
      where: { jobId, status: { not: JobStatus.COMPLETED } },
    });
    if (unprocessed > 0) {
      await refundCredits(job.userId, unprocessed, jobId).catch(console.error);
    }
  }
}
