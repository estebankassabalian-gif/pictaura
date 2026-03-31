import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { MAX_FILE_SIZE_BYTES } from "@/config/plans";
import { detectMimeFromMagicBytes } from "@/services/storage";
import { analyzePhotoForRetouching } from "@/lib/gemini";
import { AGENTS } from "@/config/agents";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

/**
 * POST /api/analyze-ai
 * Analyse IA d'une photo — retourne des suggestions de retouche contextuelles.
 * GRATUIT (aucun credit debite). Cout API : ~$0.001.
 * Rate limit : max 20/heure par user (admin exempt).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  // Rate limit : max 30 analyses/heure (free endpoint — prevent abuse)
  // Compte les jobs récents comme proxy d'activité (pas de table dédiée pour les analyses)
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

  const formData = await req.formData();
  const file = formData.get("photo") as File | null;
  const preset = formData.get("preset") as string | null;

  if (!file) return NextResponse.json({ error: "Photo requise" }, { status: 400 });
  if (!preset) return NextResponse.json({ error: "Preset requis" }, { status: 400 });

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const detectedMime = detectMimeFromMagicBytes(buffer);
  if (!detectedMime) {
    return NextResponse.json({ error: "Type d'image non reconnu" }, { status: 400 });
  }

  try {
    const agent = AGENTS[preset];
    const analyzePrompt = agent?.analyzePrompt ??
      `Analyze this image and identify 3 to 5 concrete retouching improvements in French.
Respond ONLY with valid JSON: {"analysis":"description","suggestions":["s1","s2","s3"]}`;

    const imageBase64 = buffer.toString("base64");
    const result = await analyzePhotoForRetouching(imageBase64, analyzePrompt);

    return NextResponse.json({
      analysis: result.analysis,
      suggestions: result.suggestions,
    });
  } catch (err) {
    console.error("Analyze AI error:", err);
    return NextResponse.json({ error: "Analyse IA indisponible" }, { status: 500 });
  }
}
