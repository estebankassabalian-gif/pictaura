import sharp from "sharp";
import { runRealESRGAN, downloadReplicateOutput } from "@/lib/replicate";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/r2";
import { v4 as uuidv4 } from "uuid";

const TARGET_WIDTH = 1920;
const TARGET_HEIGHT = 1280;
const JPEG_QUALITY = 85;

/**
 * Détecte si une photo est un intérieur ou un extérieur.
 * Extérieur : luminance élevée + canal bleu dominant (ciel)
 * Intérieur : luminance modérée + rouge/vert dominant (lumière artificielle)
 */
async function detectScene(buffer: Buffer): Promise<"interior" | "exterior"> {
  const stats = await sharp(buffer).stats();
  const r = stats.channels[0].mean;
  const g = stats.channels[1].mean;
  const b = stats.channels[2].mean;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const blueRatio = b / (r + 0.001);

  // Extérieur : très lumineux ET canal bleu fort (ciel visible)
  if (luminance > 0.55 && blueRatio > 0.95) return "exterior";
  return "interior";
}

/**
 * HDR tone mapping simulé avec Sharp.
 * Compresse les hautes lumières (fenêtres surexposées) et ouvre les ombres.
 */
async function applyHDRToneMapping(buffer: Buffer): Promise<Buffer> {
  // Shadow lift + highlight compression simulés via gamma + linear
  // gamma accepte uniquement [1.0, 3.0] dans Sharp
  const result = await sharp(buffer)
    .gamma(1.4) // Ouvre les ombres (shadow lift)
    .linear(0.90, 12) // Compresse les hautes lumières + lift des noirs
    .toBuffer();

  return result;
}

/**
 * Pipeline Airbnb — Spécialisé vente de logement.
 *
 * Intérieur (salon, chambre, cuisine) :
 * - Tons chauds (orange léger) = sentiment "chez soi" = plus de réservations
 * - Récupération des hautes lumières (fenêtres)
 * - Ombres ouvertes (on voit tous les détails)
 * - Légère vignette pour attirer l'œil vers le centre
 *
 * Extérieur (terrasse, jardin, piscine, façade) :
 * - Couleurs naturelles (ne pas brûler le ciel ou les plantes)
 * - Saturation verte pour les espaces verts
 * - Ciel légèrement boosté
 *
 * @returns Buffer JPEG 1920×1280
 */
export async function processAirbnb(inputBuffer: Buffer): Promise<Buffer> {
  const rotated = await sharp(inputBuffer).rotate().toBuffer();

  // ── Analyse de la scène ──────────────────────────────────
  const stats = await sharp(rotated).stats();
  const r = stats.channels[0].mean;
  const g = stats.channels[1].mean;
  const b = stats.channels[2].mean;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const scene = await detectScene(rotated);

  // ── Paramètres adaptatifs ────────────────────────────────
  let brightness: number;
  let saturation: number;
  let contrastMul: number;
  let warmth: number; // Décalage vers l'orange (boost R, réduction B)

  if (scene === "interior") {
    // INTÉRIEUR : chaleur + HDR
    warmth = 0.08;
    if (luminance > 0.55) {
      brightness = 0.97; saturation = 1.10; contrastMul = 1.06;
    } else if (luminance > 0.40) {
      brightness = 1.05; saturation = 1.15; contrastMul = 1.10;
    } else if (luminance > 0.25) {
      brightness = 1.12; saturation = 1.20; contrastMul = 1.14;
    } else {
      brightness = 1.20; saturation = 1.25; contrastMul = 1.18;
    }
  } else {
    // EXTÉRIEUR : naturel + léger boost vert/bleu
    warmth = -0.02; // Légèrement frais pour préserver ciel et végétation
    if (luminance > 0.65) {
      brightness = 0.96; saturation = 1.08; contrastMul = 1.05;
    } else if (luminance > 0.50) {
      brightness = 1.02; saturation = 1.12; contrastMul = 1.08;
    } else {
      brightness = 1.08; saturation = 1.18; contrastMul = 1.12;
    }
  }

  // ── Étape 1 : Enhancement Sharp ─────────────────────────
  // Resize à 960×640 avant Replicate (limite GPU)
  const preProcess = await sharp(rotated)
    .resize(960, 640, {
      fit: "cover",
      position: "attention",
      withoutEnlargement: false,
    })
    .toBuffer();

  // HDR tone mapping simulé
  const hdrBuffer = await applyHDRToneMapping(preProcess);

  // Grading couleur avec matrice de transformation (chaleur/froid)
  // recomb : matrice 3×3 appliquée sur RGB
  // Chaleur = boost R, légère réduction B
  const warmMatrix = (scene === "interior"
    ? [
        [1.0 + warmth, 0.0,         0.0],
        [0.0,          1.0,         0.0],
        [-warmth * 0.5, 0.0,        1.0 - warmth],
      ]
    : [
        [1.0,    0.0,  0.0],
        [0.0,    1.02, 0.0],
        [0.0,    0.02, 1.01],
      ]) as [[number,number,number],[number,number,number],[number,number,number]];

  const step1 = await sharp(hdrBuffer)
    .recomb(warmMatrix)
    .modulate({ brightness, saturation })
    .linear(contrastMul, -(contrastMul - 1) * 120)
    .gamma(1.06)
    .sharpen({ sigma: 0.5 })
    .jpeg({ quality: 92, progressive: true })
    .toBuffer();

  // ── Étape 2 : real-esrgan (avec fallback Sharp si Replicate indisponible) ──
  const tempKey = `temp/${uuidv4()}.jpg`;
  await uploadToR2(tempKey, step1, "image/jpeg");
  const tempUrl = await getSignedDownloadUrl(tempKey);

  let step2Buffer: Buffer;
  try {
    const replicateOutputUrl = await runRealESRGAN(tempUrl, 2);
    step2Buffer = await downloadReplicateOutput(replicateOutputUrl);
  } catch (replicateError) {
    // Fallback : upscaling Sharp natif si Replicate échoue
    console.warn("Real-ESRGAN indisponible, fallback Sharp upscaling:", replicateError);
    step2Buffer = await sharp(step1)
      .resize(TARGET_WIDTH * 2, TARGET_HEIGHT * 2, { fit: "cover", kernel: "lanczos3" })
      .toBuffer();
  } finally {
    try {
      const { deleteFromR2 } = await import("@/lib/r2");
      await deleteFromR2(tempKey);
    } catch { /* ignore */ }
  }

  // ── Étape 3 : Finition + légère vignette Airbnb ──────────
  // La vignette guide l'œil vers le centre de la pièce (biais attentionnel)
  const finalResized = await sharp(step2Buffer)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "cover", position: "attention" })
    .toBuffer();

  // Vignette : overlay noir transparent aux coins
  const vignetteOverlay = Buffer.from(
    `<svg width="${TARGET_WIDTH}" height="${TARGET_HEIGHT}">
      <radialGradient id="v" cx="50%" cy="50%" r="70%">
        <stop offset="60%" stop-color="black" stop-opacity="0"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.18"/>
      </radialGradient>
      <rect width="100%" height="100%" fill="url(#v)"/>
    </svg>`
  );

  const final = await sharp(finalResized)
    .composite([{ input: vignetteOverlay, blend: "multiply" }])
    .jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true })
    .withMetadata({ exif: {} })
    .toBuffer();

  return final;
}
