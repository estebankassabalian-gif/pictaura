import sharp from "sharp";
import { getPlatformById } from "@/config/platforms";

/**
 * JPEG output config tuned for SEO / Core Web Vitals:
 * - quality 92 = Lightroom/Adobe Bridge default, photography industry standard
 * - mozjpeg = better compression than libjpeg at the same visual quality (~15-20% smaller)
 * - progressive = page LCP renders the image progressively, better perceived speed
 * - chromaSubsampling 4:2:0 = halves chroma data with imperceptible loss on photos
 */
const JPEG_OUT = {
  quality: 92,
  progressive: true,
  mozjpeg: true,
  chromaSubsampling: "4:2:0" as const,
};

/**
 * Recadre/redimensionne l'image retouchée aux dimensions exactes de la plateforme
 * cible (Vinted 3:4, Reels 9:16, Shopify 1:1, etc.) ET garantit une sortie JPEG
 * raisonnablement compressée même quand aucune plateforme n'est sélectionnée
 * (sinon le buffer brut de Gemini peut être un PNG de plusieurs Mo, mauvais pour
 * le SEO via LCP).
 *
 * Smart-crop Sharp (position: "attention") garde la zone la plus saillante :
 * visages, contrastes, netteté — fiable pour portraits, produits, immo.
 * withoutEnlargement implicite : on ne fait jamais d'upscale (ratio préservé).
 *
 * Non-bloquant : si l'opération échoue, on renvoie le buffer d'origine intact.
 */
export async function cropToPlatform(
  buffer: Buffer,
  preset: string,
  platformId: string | null | undefined
): Promise<Buffer> {
  try {
    const metadata = await sharp(buffer).metadata();
    const srcW = metadata.width ?? 0;
    const srcH = metadata.height ?? 0;
    if (srcW === 0 || srcH === 0) return buffer;

    // Pas de plateforme sélectionnée → on normalise quand même en JPEG q=92
    // pour éviter de servir un PNG de Gemini de plusieurs Mo (pénalité SEO LCP).
    if (!platformId) {
      if (metadata.format === "jpeg" || metadata.format === "jpg") {
        // Déjà en JPEG → on garde le buffer (potentiellement déjà bien compressé par Gemini)
        return buffer;
      }
      return await sharp(buffer).jpeg(JPEG_OUT).toBuffer();
    }

    const platform = getPlatformById(preset, platformId);
    if (!platform) return buffer;

    // Si la source est plus petite que la cible sur un axe, on conserve le ratio
    // exact mais en réduisant les dimensions cibles pour ne pas upscaler.
    let targetW = platform.width;
    let targetH = platform.height;
    if (srcW < targetW || srcH < targetH) {
      const scale = Math.min(srcW / platform.width, srcH / platform.height);
      targetW = Math.round(platform.width * scale);
      targetH = Math.round(platform.height * scale);
    }

    return await sharp(buffer)
      .resize(targetW, targetH, {
        fit: "cover",
        position: "attention",
      })
      .jpeg(JPEG_OUT)
      .toBuffer();
  } catch (err) {
    console.error(`platform-crop failed for ${platformId ?? "(no-platform)"}:`, err);
    return buffer;
  }
}
