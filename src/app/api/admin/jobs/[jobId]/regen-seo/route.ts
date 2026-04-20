import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JobStatus } from "@prisma/client";
import { getSignedDownloadUrl } from "@/lib/r2";
import { uploadProcessedPhoto } from "@/services/storage";
import { generatePhotoSEO, scorePhoto } from "@/lib/gemini";
import { injectExifMetadata } from "@/services/processing/exif";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { jobId } = await params;

  const job = await prisma.processingJob.findUnique({
    where: { id: jobId },
    include: {
      user: { select: { businessCity: true } },
      photos: { where: { status: JobStatus.COMPLETED, processedKey: { not: null } } },
    },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  let regenerated = 0;
  let failed = 0;

  for (const photo of job.photos) {
    if (!photo.processedKey) continue;
    try {
      const url = await getSignedDownloadUrl(photo.processedKey);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Fetch R2 failed");
      const buffer = Buffer.from(await res.arrayBuffer());

      const base64 = buffer.toString("base64");
      const [seo, score] = await Promise.all([
        generatePhotoSEO(base64, job.preset, job.user?.businessCity ?? undefined),
        scorePhoto(base64, job.preset),
      ]);

      // Si SEO vide (Gemini down), on saute pour ne pas polluer la DB
      if (!seo.altText && !seo.seoFileName) {
        failed++;
        continue;
      }

      const enriched = await injectExifMetadata(buffer, {
        altText: seo.altText,
        seoFileName: seo.seoFileName,
        description: seo.description,
        keywords: seo.keywords,
        metaTitle: seo.metaTitle,
        hashtags: seo.hashtags,
        schemaJsonLd: seo.seoSchemaJson,
        preset: job.preset,
      });

      const photoUuid = photo.processedKey.split("/").pop()?.split(".")[0] ?? photo.id;
      const newKey = await uploadProcessedPhoto(enriched, job.userId, job.id, photoUuid);

      await prisma.processedPhoto.update({
        where: { id: photo.id },
        data: {
          processedKey: newKey,
          fileSizeProcessed: enriched.length,
          seoAltText: seo.altText || null,
          seoFileName: seo.seoFileName || null,
          seoDescription: seo.description || null,
          seoKeywords: seo.keywords || null,
          seoMetaTitle: seo.metaTitle || null,
          seoHashtags: seo.hashtags || null,
          seoSchemaJson: seo.seoSchemaJson || null,
          photoScore: score.score || null,
          photoScoreReport: score.report || null,
        },
      });
      regenerated++;
    } catch (e) {
      console.error(`Regen SEO failed for photo ${photo.id}:`, e);
      failed++;
    }
  }

  return NextResponse.json({ regenerated, failed, total: job.photos.length });
}
