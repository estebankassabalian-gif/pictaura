import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JobStatus } from "@prisma/client";
import { getSignedDownloadUrl } from "@/lib/r2";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { jobId } = await params;
  const { searchParams } = new URL(req.url);
  const photoId = searchParams.get("photoId");

  try {
    const job = await prisma.processingJob.findFirst({
      where: { id: jobId, userId: session.user.id },
      include: {
        photos: {
          where: { status: JobStatus.COMPLETED, processedKey: { not: null } },
        },
      },
    });

    if (!job || job.photos.length === 0) {
      return NextResponse.json({ error: "Aucune photo disponible" }, { status: 404 });
    }

    // If photoId specified, download that specific photo; otherwise download the first one
    const photo = photoId
      ? job.photos.find((p) => p.id === photoId)
      : job.photos[0];

    if (!photo || !photo.processedKey) {
      return NextResponse.json({ error: "Photo non trouvée" }, { status: 404 });
    }

    const signedUrl = await getSignedDownloadUrl(photo.processedKey);
    const response = await fetch(signedUrl);
    if (!response.ok) throw new Error("Impossible de télécharger la photo");

    const buffer = Buffer.from(await response.arrayBuffer());
    const fileName = photo.seoFileName
      ? `${photo.seoFileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "-")}.jpg`
      : `pictaura-${job.preset.toLowerCase()}-${photo.fileName.replace(/\.[^.]+$/, "")}.jpg`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="${fileName.replace(/["\\]/g, "_")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Impossible de télécharger" },
      { status: 500 }
    );
  }
}
