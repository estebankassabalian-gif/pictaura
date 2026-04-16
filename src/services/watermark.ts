import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";

// Logo chargé une seule fois (Next.js hot-reload compatible)
let cachedLogoSvg: string | null = null;
function getLogoSvg(): string {
  if (cachedLogoSvg) return cachedLogoSvg;
  const logoPath = join(process.cwd(), "public", "logo.svg");
  cachedLogoSvg = readFileSync(logoPath, "utf-8");
  return cachedLogoSvg;
}

/**
 * Applique le logo Pictaura transparent au centre d'une photo.
 * Réservé aux 5 retouches offertes à l'inscription (freemium).
 * Le logo fait ~40% de la largeur, opacité ~0.35, impossible à cropper proprement.
 */
export async function applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 1920;
  const height = metadata.height ?? 1280;

  const logoWidth = Math.round(Math.min(width, height) * 0.42);
  const baseSvg = getLogoSvg();

  // On injecte une opacity sur le <svg> racine + on redimensionne en rendu
  const watermarkBuffer = await sharp(Buffer.from(baseSvg))
    .resize({ width: logoWidth })
    .ensureAlpha()
    .composite([
      {
        input: Buffer.from([255, 255, 255, 90]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  const logoMeta = await sharp(watermarkBuffer).metadata();
  const logoW = logoMeta.width ?? logoWidth;
  const logoH = logoMeta.height ?? Math.round(logoWidth * 0.28);

  return sharp(imageBuffer)
    .composite([
      {
        input: watermarkBuffer,
        left: Math.round((width - logoW) / 2),
        top: Math.round((height - logoH) / 2),
        blend: "over",
      },
    ])
    .toBuffer();
}
