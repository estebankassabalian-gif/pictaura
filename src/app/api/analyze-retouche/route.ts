import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzePhotoForRetouching } from "@/lib/gemini";
import { getFreshSignedUrl } from "@/services/storage";
import { DEFAULT_SUGGESTIONS } from "@/config/retouching-suggestions";
import { AGENTS } from "@/config/agents";
import { JobStatus } from "@prisma/client";
import { z } from "zod";

export const maxDuration = 60;

const schema = z.object({
  photoId: z.string().uuid(),
});

/**
 * POST /api/analyze-retouche
 * Analyse une photo et retourne des suggestions de retouche adaptées au preset.
 * GRATUIT — aucun crédit débité. Coût API : ~$0.001 (Gemini 1.5 Flash text only).
 * Rate limit : max 20/heure par user (admin exempt).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit : max 30 analyses/heure (free endpoint — prevent abuse)
  if (session.user.role !== "ADMIN") {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recentJobs, recentInpaints] = await Promise.all([
      prisma.processingJob.count({ where: { userId: session.user.id, createdAt: { gte: oneHourAgo } } }),
      prisma.inpaintingJob.count({ where: { userId: session.user.id, createdAt: { gte: oneHourAgo } } }),
    ]);
    if (recentJobs + recentInpaints >= 30) {
      return NextResponse.json({ error: "Limite horaire atteinte. Réessayez plus tard." }, { status: 429 });
    }
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "photoId invalide" }, { status: 400 });
  }

  const { photoId } = parsed.data;
  const userId = session.user.id;

  // Vérifier ownership : la photo doit appartenir à cet utilisateur
  const photo = await prisma.processedPhoto.findFirst({
    where: {
      id: photoId,
      job: { userId },
      status: JobStatus.COMPLETED,
      processedKey: { not: null },
    },
    include: { job: { select: { preset: true } } },
  });

  if (!photo || !photo.processedKey) {
    return NextResponse.json({ error: "Photo non trouvée ou non traitée" }, { status: 404 });
  }

  const preset = photo.job.preset;

  try {
    // Télécharger l'image depuis R2
    const imageUrl = await getFreshSignedUrl(photo.processedKey);
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) throw new Error("Impossible de télécharger l'image");

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const imageBase64 = imageBuffer.toString("base64");

    // Analyse Gemini (gratuite) — utilise le prompt d'analyse de l'agent métier
    const agent = AGENTS[preset];
    const analyzePrompt = agent?.analyzePrompt ??
      `Analyze this image and identify 3 to 5 concrete retouching improvements in French.
Respond ONLY with valid JSON: {"analysis":"description","suggestions":["s1","s2","s3"]}`;
    const { analysis, suggestions } = await analyzePhotoForRetouching(imageBase64, analyzePrompt);

    return NextResponse.json({ analysis, suggestions, preset });
  } catch (error) {
    console.error("analyze-retouche error:", error);

    // Fallback : retourner les suggestions par défaut du preset
    const fallbackSuggestions = DEFAULT_SUGGESTIONS[preset] ?? DEFAULT_SUGGESTIONS["IMMOBILIER"] ?? [];
    return NextResponse.json({
      analysis: "Suggestions adaptées à votre secteur",
      suggestions: fallbackSuggestions.map((s) => s.label),
      preset,
      fallback: true,
    });
  }
}
