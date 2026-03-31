import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deductCreditsAtomic, refundCredits } from "@/services/credits";
import { generateKenBurnsReel, KenBurnsStyle } from "@/services/processing/ken-burns";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/r2";
import { v4 as uuidv4 } from "uuid";
import { MAX_FILE_SIZE_BYTES } from "@/config/plans";
import { detectMimeFromMagicBytes } from "@/services/storage";

export const maxDuration = 120;

const REEL_CREDITS_COST = 3;

const VALID_STYLES: KenBurnsStyle[] = ["zoom-in", "zoom-out", "pan-right", "pan-left", "diagonal"];
const VALID_FILTERS = ["cinematic", "warm", "film", "pop", "none"];

/**
 * POST /api/reel
 * Convertit une photo en Reel MP4 Instagram via effet Ken Burns.
 * Coût : 3 crédits (premium — Reels = 3-5x plus de reach)
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = session.user.id;

  const formData = await req.formData();
  const photo = formData.get("photo") as File | null;
  const style = (formData.get("style") as KenBurnsStyle) ?? "zoom-in";
  const filter = (formData.get("filter") as string) ?? "cinematic";
  const duration = parseInt(formData.get("duration") as string ?? "4", 10);

  if (!photo) {
    return NextResponse.json({ error: "Photo requise" }, { status: 400 });
  }

  // File size validation
  if (photo.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)" }, { status: 413 });
  }

  if (!VALID_STYLES.includes(style)) {
    return NextResponse.json({ error: "Style invalide" }, { status: 400 });
  }

  const clampedDuration = Math.max(3, Math.min(8, duration));

  // Magic bytes validation
  const rawBuffer = Buffer.from(await photo.arrayBuffer());
  const detectedMime = detectMimeFromMagicBytes(rawBuffer);
  if (!detectedMime) {
    return NextResponse.json({ error: "Fichier invalide : type d'image non reconnu" }, { status: 400 });
  }

  const reelId = uuidv4();

  // Vérifier ET déduire les crédits en une seule transaction atomique
  const deducted = await deductCreditsAtomic(userId, REEL_CREDITS_COST, reelId, "Génération Reel Instagram (Ken Burns)");
  if (!deducted) {
    return NextResponse.json(
      { error: `${REEL_CREDITS_COST} crédits requis pour générer un Reel` },
      { status: 402 }
    );
  }

  try {
    const buffer = rawBuffer;

    const mp4Buffer = await generateKenBurnsReel(buffer, {
      style,
      filter: VALID_FILTERS.includes(filter) ? filter : "cinematic",
      duration: clampedDuration,
      fps: 30,
    });

    // Upload le MP4 vers R2
    const reelKey = `reels/${userId}/${reelId}.mp4`;
    await uploadToR2(reelKey, mp4Buffer, "video/mp4");
    const reelUrl = await getSignedDownloadUrl(reelKey);

    return NextResponse.json({
      reelUrl,
      reelKey,
      duration: clampedDuration,
      style,
      filter,
      sizeMb: Math.round(mp4Buffer.length / 1024 / 1024 * 10) / 10,
    });

  } catch (error) {
    console.error("Reel generation error:", error);
    await refundCredits(userId, REEL_CREDITS_COST, reelId).catch(console.error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du Reel. Crédits remboursés." },
      { status: 500 }
    );
  }
}
