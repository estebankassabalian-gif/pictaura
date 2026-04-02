import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JobStatus } from "@prisma/client";
import { getSignedDownloadUrl } from "@/lib/r2";
import { generateJobZip } from "@/services/processing/zip";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { jobId } = await params;

  try {
    // Check job ownership and get completed photos
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

    // Single photo → serve directly as JPEG (no ZIP)
    if (job.photos.length === 1) {
      const photo = job.photos[0];
      const signedUrl = await getSignedDownloadUrl(photo.processedKey!);
      const response = await fetch(signedUrl);
      if (!response.ok) throw new Error("Impossible de telecharger la photo");

      const buffer = Buffer.from(await response.arrayBuffer());
      const fileName = photo.seoFileName
        ? `${photo.seoFileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "-")}.jpg`
        : `pictaura-${job.preset.toLowerCase()}.jpg`;

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // Multiple photos → generate ZIP
    const { stream, filename } = await generateJobZip(jobId, session.user.id);

    const readableStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk: Buffer) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err: Error) => controller.error(err));
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "'").replace(/[\r\n]/g, "")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Impossible de telecharger" },
      { status: 500 }
    );
  }
}
