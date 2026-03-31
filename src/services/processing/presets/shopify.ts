import sharp from "sharp";
import { runRemoveBg, downloadReplicateOutput } from "@/lib/replicate";
import { uploadToR2, getSignedDownloadUrl, deleteFromR2 } from "@/lib/r2";
import { v4 as uuidv4 } from "uuid";

const TARGET_SIZE = 2048;
const PRODUCT_SIZE = 1800;

/**
 * Détecte si une photo est lifestyle (contexte/décor) ou produit seul.
 * Lifestyle : fond complexe, couleurs variées, beaucoup de contenu
 * Produit seul : fond uni ou simple, objet central clair
 */
async function detectShopifyMode(buffer: Buffer): Promise<"product" | "lifestyle"> {
  const stats = await sharp(buffer).stats();

  // Mesure la variance des canaux : haute variance = fond complexe (lifestyle)
  const rVariance = stats.channels[0].stdev;
  const gVariance = stats.channels[1].stdev;
  const bVariance = stats.channels[2].stdev;
  const avgVariance = (rVariance + gVariance + bVariance) / 3;

  // Seuil empirique : variance > 60 = image complexe (lifestyle)
  return avgVariance > 60 ? "lifestyle" : "product";
}

/**
 * Ombre portée douce pour produit Shopify.
 * Plus prononcée que Vinted (produit e-commerce = profondeur = premium)
 */
async function generateProductShadow(productBuffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(productBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const shadowPixels = Buffer.from(data);
  for (let i = 0; i < shadowPixels.length; i += 4) {
    shadowPixels[i] = 0;
    shadowPixels[i + 1] = 0;
    shadowPixels[i + 2] = 0;
    // Ombre plus marquée pour Shopify (35% vs 28% pour Vinted)
    shadowPixels[i + 3] = Math.round(shadowPixels[i + 3] * 0.35);
  }

  return sharp(shadowPixels, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .blur(30) // Ombre plus large = effet studio haut de gamme
    .png()
    .toBuffer();
}

/**
 * Pipeline Shopify — Spécialisé e-commerce.
 *
 * Mode PRODUCT (fond simple/uni détecté) :
 * - remove-bg → fond blanc parfait
 * - Auto-crop serré + ombre portée professionnelle
 * - Sharpening sélectif pour détails produit (textures, finitions)
 * - 2048×2048 pour le zoom Shopify
 *
 * Mode LIFESTYLE (fond complexe/décor détecté) :
 * - Pas de remove-bg (ça détruirait le contexte)
 * - Recadrage 1:1, couleurs fidèles, légère netteté
 * - Idéal pour photos "en situation" avec modèle ou décor
 *
 * @returns Buffer JPEG 2048×2048
 */
export async function processShopify(inputBuffer: Buffer): Promise<Buffer> {
  const rotated = await sharp(inputBuffer).rotate().toBuffer();

  // ── Analyse de la photo ──────────────────────────────────
  const stats = await sharp(rotated).stats();
  const r = stats.channels[0].mean;
  const g = stats.channels[1].mean;
  const b = stats.channels[2].mean;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const mode = await detectShopifyMode(rotated);

  let brightness: number;
  let saturation: number;

  if (luminance > 0.65) {
    brightness = 1.03; saturation = 1.05;
  } else if (luminance > 0.45) {
    brightness = 1.08; saturation = 1.10;
  } else {
    brightness = 1.14; saturation = 1.15;
  }

  if (mode === "lifestyle") {
    // ── Mode LIFESTYLE : recadrage + enhancement ──────────
    const result = await sharp(rotated)
      .resize(TARGET_SIZE, TARGET_SIZE, {
        fit: "cover",
        position: "attention",
      })
      .modulate({ brightness, saturation })
      .sharpen({ sigma: 0.8, m1: 1.5, m2: 0.5 })
      .linear(1.06, -7)
      .jpeg({ quality: 90, progressive: true, mozjpeg: true })
      .withMetadata({ exif: {} })
      .toBuffer();

    return result;
  }

  // ── Mode PRODUCT : remove-bg + fond blanc + ombre ────────

  // Resize avant remove-bg (limite GPU Replicate)
  const prepared = await sharp(rotated)
    .resize(1400, 1400, { fit: "inside", withoutEnlargement: false })
    .jpeg({ quality: 95 })
    .toBuffer();

  const tempKey = `temp/${uuidv4()}.jpg`;
  await uploadToR2(tempKey, prepared, "image/jpeg");
  const tempUrl = await getSignedDownloadUrl(tempKey);

  let noBgBuffer: Buffer;
  try {
    const noBgUrl = await runRemoveBg(tempUrl);
    noBgBuffer = await downloadReplicateOutput(noBgUrl);
  } catch {
    console.warn("Shopify: remove-bg indisponible, fallback fond blanc Sharp");
    noBgBuffer = await sharp(prepared)
      .resize(TARGET_SIZE, TARGET_SIZE, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 255 } })
      .png()
      .toBuffer();
  } finally {
    try { await deleteFromR2(tempKey); } catch { /* ignore */ }
  }

  // Auto-crop serré
  const trimmed = await sharp(noBgBuffer)
    .trim({ threshold: 10 })
    .png()
    .toBuffer();

  // Resize produit + enhancement
  const productResized = await sharp(trimmed)
    .resize(PRODUCT_SIZE, PRODUCT_SIZE, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .modulate({ brightness, saturation })
    .sharpen({ sigma: 1.0, m1: 1.8, m2: 0.4 }) // Sharpening accentué pour détails produit
    .png()
    .toBuffer();

  // Ombre portée
  const shadowLayer = await generateProductShadow(productResized);
  const centerPos = Math.round((TARGET_SIZE - PRODUCT_SIZE) / 2);
  const shadowOffset = 22;

  const result = await sharp({
    create: {
      width: TARGET_SIZE,
      height: TARGET_SIZE,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      { input: shadowLayer, top: centerPos + shadowOffset, left: centerPos + 6 },
      { input: productResized, top: centerPos, left: centerPos },
    ])
    .jpeg({ quality: 90, progressive: true, mozjpeg: true })
    .withMetadata({ exif: {} })
    .toBuffer();

  return result;
}
