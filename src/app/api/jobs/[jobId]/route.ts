import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JobStatus, Role } from "@prisma/client";
import { getFreshSignedUrl } from "@/services/storage";
import { computeConcurrency } from "@/services/processing/pipeline";

// Fallback when no measured duration is available yet (fresh DB) :
// ordre de grandeur réel d'une génération Gemini 3.1 Flash Image.
const DEFAULT_PHOTO_MS = 90_000;

/**
 * ETA honnête, calculée à partir des durées réellement mesurées (processingMs) :
 * d'abord celles du job lui-même (reflète la charge Gemini du moment), sinon la
 * moyenne des 50 dernières photos traitées toutes plateformes confondues.
 */
async function computeEtaSeconds(job: {
  photoCount: number;
  photos: Array<{ status: JobStatus; processingMs: number | null }>;
}): Promise<number> {
  // Photos en attente/en cours + celles pas encore uploadées (le pipeline
  // streaming démarre pendant l'upload : des photos comptées dans photoCount
  // n'ont pas encore de ligne en DB).
  const remaining =
    job.photos.filter(
      (p) => p.status === JobStatus.PENDING || p.status === JobStatus.PROCESSING
    ).length + Math.max(0, job.photoCount - job.photos.length);
  if (remaining === 0) return 0;

  const ownDurations = job.photos
    .map((p) => p.processingMs)
    .filter((ms): ms is number => ms != null && ms > 0);

  let avgMs: number;
  if (ownDurations.length > 0) {
    avgMs = ownDurations.reduce((a, b) => a + b, 0) / ownDurations.length;
  } else {
    // Moyenne glissante des 50 dernières photos : suit la charge Gemini du moment.
    const recent = await prisma.processedPhoto.findMany({
      where: { status: JobStatus.COMPLETED, processingMs: { gt: 0 } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { processingMs: true },
    });
    avgMs =
      recent.length > 0
        ? recent.reduce((a, p) => a + (p.processingMs ?? 0), 0) / recent.length
        : DEFAULT_PHOTO_MS;
  }

  const concurrency = computeConcurrency(job.photoCount);
  return Math.ceil((remaining * avgMs) / concurrency / 1000);
}

// In-memory signed URL cache (TTL 10 minutes) — avoids regenerating for every poll
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const URL_CACHE_TTL = 10 * 60 * 1000; // 10 min

function getCachedUrl(key: string): string | null {
  const entry = urlCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.url;
  urlCache.delete(key);
  return null;
}

function setCachedUrl(key: string, url: string) {
  urlCache.set(key, { url, expiresAt: Date.now() + URL_CACHE_TTL });
  // Lazy cleanup: prune old entries when cache grows too large
  if (urlCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of urlCache) {
      if (v.expiresAt < now) urlCache.delete(k);
    }
  }
}

async function getSignedUrlCached(key: string): Promise<string> {
  const cached = getCachedUrl(key);
  if (cached) return cached;
  const url = await getFreshSignedUrl(key);
  setCachedUrl(key, url);
  return url;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { jobId } = await params;
  const isAdmin = session.user.role === Role.ADMIN;

  const job = await prisma.processingJob.findFirst({
    where: {
      id: jobId,
      ...(isAdmin ? {} : { userId: session.user.id }),
    },
    include: {
      photos: {
        orderBy: { createdAt: "asc" },
      },
      user: {
        select: { role: true, isSubscribed: true },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job non trouvé" }, { status: 404 });
  }

  // Generate signed URLs in parallel with caching
  const photosWithUrls = await Promise.all(
    job.photos.map(async (photo) => {
      let originalUrl: string | null = null;
      let processedUrl: string | null = null;

      try {
        originalUrl = await getSignedUrlCached(photo.originalKey);
      } catch { /* ignore */ }

      if (photo.processedKey) {
        try {
          processedUrl = await getSignedUrlCached(photo.processedKey);
        } catch { /* ignore */ }
      }

      return {
        id: photo.id,
        fileName: photo.fileName,
        status: photo.status,
        originalUrl,
        processedUrl,
        fileSizeOriginal: photo.fileSizeOriginal,
        fileSizeProcessed: photo.fileSizeProcessed,
        seoAltText: photo.seoAltText,
        seoFileName: photo.seoFileName,
        seoDescription: photo.seoDescription,
        seoKeywords: photo.seoKeywords,
        seoMetaTitle: photo.seoMetaTitle,
        seoHashtags: photo.seoHashtags,
        seoSchemaJson: photo.seoSchemaJson,
        photoScore: photo.photoScore,
        photoScoreReport: photo.photoScoreReport,
      };
    })
  );

  const isWatermarked = job.user?.isSubscribed !== true && job.user?.role !== Role.ADMIN;

  const isRunning = job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING;
  const etaSeconds = isRunning ? await computeEtaSeconds(job) : 0;

  return NextResponse.json({
    id: job.id,
    preset: job.preset,
    status: job.status,
    photoCount: job.photoCount,
    creditsCost: job.creditsCost,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    isWatermarked,
    etaSeconds,
    photos: photosWithUrls,
  });
}
