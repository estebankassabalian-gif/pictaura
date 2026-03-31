import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { getFreshSignedUrl } from "@/services/storage";

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
      // Admin peut voir tous les jobs, user seulement les siens
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

  // Générer des URLs signées fraîches en parallèle
  const photosWithUrls = await Promise.all(
    job.photos.map(async (photo) => {
      let originalUrl: string | null = null;
      let processedUrl: string | null = null;

      try {
        originalUrl = await getFreshSignedUrl(photo.originalKey);
      } catch { /* ignore */ }

      if (photo.processedKey) {
        try {
          processedUrl = await getFreshSignedUrl(photo.processedKey);
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

  // Watermark actif si non abonné et non admin
  const isWatermarked = job.user?.isSubscribed !== true && job.user?.role !== Role.ADMIN;

  return NextResponse.json({
    id: job.id,
    preset: job.preset,
    status: job.status,
    photoCount: job.photoCount,
    creditsCost: job.creditsCost,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    isWatermarked,
    photos: photosWithUrls,
  });
}
