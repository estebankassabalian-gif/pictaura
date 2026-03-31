import sharp from "sharp";
import { runRemoveBg, runRealESRGAN, downloadReplicateOutput } from "@/lib/replicate";
import { uploadToR2, getSignedDownloadUrl, deleteFromR2 } from "@/lib/r2";
import { v4 as uuidv4 } from "uuid";

const TARGET_SIZE = 1000;
const PRODUCT_MAX = 880; // Produit occupe 88% du cadre (plus serré que avant)

/**
 * Génère une ombre portée douce sous le produit.
 * Effet studio professionnel : ombre diffuse, légère, centrée en bas.
 */
async function generateSoftShadow(
  productBuffer: Buffer,
  canvasSize: number
): Promise<Buffer> {
  const { data, info } = await sharp(productBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Assombrir les pixels : garder l'alpha (forme), mettre RGB à 0 (noir)
  const shadowPixels = Buffer.from(data);
  for (let i = 0; i < shadowPixels.length; i += 4) {
    shadowPixels[i] = 0;       // R → noir
    shadowPixels[i + 1] = 0;   // G → noir
    shadowPixels[i + 2] = 0;   // B → noir
    shadowPixels[i + 3] = Math.round(shadowPixels[i + 3] * 0.28); // Alpha 28%
  }

  // Créer le layer ombre : flou gaussien + décalage vers le bas
  return sharp(shadowPixels, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .blur(22)
    .png()
    .toBuffer();
}

/**
 * Pipeline Vinted — Spécialisé vente de vêtements & accessoires.
 *
 * Priorité : fidélité couleur (rouge ≠ orange, bleu marine ≠ noir)
 * Un acheteur qui reçoit une couleur différente = retour = mauvais rating
 *
 * Pipeline :
 * 1. Analyse couleur → paramètres fidélité
 * 2. Resize 700×700 + sharpening texture tissu
 * 3. real-esrgan → fil, coutures, reliefs visibles
 * 4. remove-bg → fond transparent
 * 5. Auto-crop serré (trim) → produit centré sans espace vide
 * 6. Canvas blanc 1000×1000 + ombre portée douce (effet studio)
 *
 * @returns Buffer JPEG 1000×1000 fond blanc avec ombre
 */
export async function processVinted(inputBuffer: Buffer): Promise<Buffer> {
  const rotated = await sharp(inputBuffer).rotate().toBuffer();

  // ── Analyse couleur ──────────────────────────────────────
  const stats = await sharp(rotated).stats();
  const r = stats.channels[0].mean;
  const g = stats.channels[1].mean;
  const b = stats.channels[2].mean;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Fidélité couleur : saturation MODÉRÉE pour préserver les teintes exactes
  // On ne veut pas transformer un bordeaux en rouge vif
  let saturation: number;
  let brightness: number;

  if (luminance > 0.60) {
    saturation = 1.04; brightness = 1.02; // Photo claire : touch minime
  } else if (luminance > 0.40) {
    saturation = 1.08; brightness = 1.08; // Standard : boost léger
  } else {
    saturation = 1.12; brightness = 1.15; // Sombre : boost modéré
  }

  // ── Étape 1 : Préparation + sharpening texture ───────────
  const step0 = await sharp(rotated)
    .resize(700, 700, { fit: "inside", withoutEnlargement: false })
    .modulate({ saturation }) // Appliqué AVANT Replicate pour meilleurs résultats
    .sharpen({ sigma: 1.0, m1: 2.0, m2: 0.5 }) // Accentue fil, coutures, textures
    .jpeg({ quality: 95 })
    .toBuffer();

  // ── Étape 2 : real-esrgan → détails tissu visibles ───────
  const tempKey1 = `temp/${uuidv4()}.jpg`;
  await uploadToR2(tempKey1, step0, "image/jpeg");
  const tempUrl1 = await getSignedDownloadUrl(tempKey1);

  let step1Buffer: Buffer;
  try {
    const upscaledUrl = await runRealESRGAN(tempUrl1, 2);
    step1Buffer = await downloadReplicateOutput(upscaledUrl);
  } catch {
    console.warn("Vinted: Real-ESRGAN indisponible, fallback Sharp");
    step1Buffer = step0;
  } finally {
    try { await deleteFromR2(tempKey1); } catch { /* ignore */ }
  }

  // ── Étape 3 : remove-bg ──────────────────────────────────
  const tempKey2 = `temp/${uuidv4()}.jpg`;
  await uploadToR2(tempKey2, step1Buffer, "image/jpeg");
  const tempUrl2 = await getSignedDownloadUrl(tempKey2);

  let noBgBuffer: Buffer;
  try {
    const noBgUrl = await runRemoveBg(tempUrl2);
    noBgBuffer = await downloadReplicateOutput(noBgUrl);
  } catch {
    // Fallback : fond blanc simulé via Sharp si remove-bg échoue
    console.warn("Vinted: remove-bg indisponible, fallback fond blanc Sharp");
    noBgBuffer = await sharp(step1Buffer)
      .resize(TARGET_SIZE, TARGET_SIZE, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 255 } })
      .png()
      .toBuffer();
  } finally {
    try { await deleteFromR2(tempKey2); } catch { /* ignore */ }
  }

  // ── Étape 4 : Auto-crop serré (trim) ─────────────────────
  // Supprime les pixels transparents autour du produit → produit bien cadré
  const trimmed = await sharp(noBgBuffer)
    .trim({ threshold: 10 }) // Crop aux bords non-transparents
    .png()
    .toBuffer();

  // ── Étape 5 : Resize produit dans le cadre ───────────────
  const productResized = await sharp(trimmed)
    .resize(PRODUCT_MAX, PRODUCT_MAX, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .modulate({ brightness }) // Brightness APRÈS remove-bg (plus précis)
    .png()
    .toBuffer();

  // ── Étape 6 : Ombre portée douce ─────────────────────────
  const shadowLayer = await generateSoftShadow(productResized, TARGET_SIZE);
  const shadowOffset = 18; // Décalage vers le bas (naturel, lumière de dessus)

  // ── Étape 7 : Composition finale ─────────────────────────
  const centerPos = Math.round((TARGET_SIZE - PRODUCT_MAX) / 2);

  const result = await sharp({
    create: {
      width: TARGET_SIZE,
      height: TARGET_SIZE,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      // Ombre en premier (derrière le produit), légèrement décalée vers le bas
      {
        input: shadowLayer,
        top: centerPos + shadowOffset,
        left: centerPos + 4,
      },
      // Produit par-dessus
      {
        input: productResized,
        top: centerPos,
        left: centerPos,
      },
    ])
    .jpeg({ quality: 90, progressive: true, mozjpeg: true })
    .withMetadata({ exif: {} })
    .toBuffer();

  return result;
}
