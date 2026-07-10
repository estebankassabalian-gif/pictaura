import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
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
  const { searchParams } = new URL(req.url);
  const photoId = searchParams.get("photoId");

  // ?format=zip → toutes les photos + seo_metadata.csv + hashtags + JSON-LD
  // en un seul téléchargement (1 clic au lieu de N téléchargements séquentiels).
  if (searchParams.get("format") === "zip") {
    try {
      const { stream, filename } = await generateJobZip(jobId, session.user.id);
      return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      console.error("ZIP download error:", error);
      return NextResponse.json({ error: "Impossible de générer le ZIP" }, { status: 500 });
    }
  }

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

    // Headers HTTP pour exposer le SEO sans avoir besoin du ZIP.
    // UTF-8 → base64 car les headers HTTP sont ASCII-only (RFC 7230).
    // Côté client : atob(decodeURIComponent(escape(header))) ou Buffer.from(h, 'base64').toString('utf8').
    const encodeHeader = (val: string | null | undefined): string =>
      val ? Buffer.from(val, "utf8").toString("base64") : "";

    const seoHeaders: Record<string, string> = {};
    const altB64 = encodeHeader(photo.seoAltText);
    const descB64 = encodeHeader(photo.seoDescription);
    const metaTitleB64 = encodeHeader(photo.seoMetaTitle);
    const keywordsB64 = encodeHeader(photo.seoKeywords);
    const hashtagsB64 = encodeHeader(photo.seoHashtags);
    const schemaB64 = encodeHeader(photo.seoSchemaJson);
    if (altB64) seoHeaders["X-Pictaura-Alt-Text-B64"] = altB64;
    if (descB64) seoHeaders["X-Pictaura-Description-B64"] = descB64;
    if (metaTitleB64) seoHeaders["X-Pictaura-Meta-Title-B64"] = metaTitleB64;
    if (keywordsB64) seoHeaders["X-Pictaura-Keywords-B64"] = keywordsB64;
    if (hashtagsB64) seoHeaders["X-Pictaura-Hashtags-B64"] = hashtagsB64;
    if (schemaB64) seoHeaders["X-Pictaura-Schema-JsonLd-B64"] = schemaB64;
    if (photo.photoScore != null) seoHeaders["X-Pictaura-Score"] = String(photo.photoScore);
    seoHeaders["X-Pictaura-Preset"] = job.preset;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="${fileName.replace(/["\\]/g, "_")}"`,
        "Cache-Control": "no-store",
        "Access-Control-Expose-Headers": Object.keys(seoHeaders).join(", "),
        ...seoHeaders,
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
