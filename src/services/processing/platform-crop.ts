import sharp from "sharp";
import { getPlatformById } from "@/config/platforms";

/**
 * Recadre/redimensionne l'image retouchée aux dimensions exactes de la plateforme
 * cible (Vinted 3:4, Reels 9:16, Shopify 1:1, etc.).
 *
 * Gemini ne respecte pas toujours le ratio demandé dans le prompt, donc on force
 * le format en post-traitement pour garantir la promesse produit.
 *
 * Stratégie :
 * - fit "cover" + position "attention" : smart-crop Sharp qui garde la zone la plus
 *   saillante (visages, contrastes, netteté) — fiable pour portraits, produits, immo
 * - withoutEnlargement: true : si Gemini retourne une image plus petite que la cible,
 *   on garde le ratio exact mais sans upscaler (pas de perte de qualité)
 *
 * Non-bloquant : si le crop échoue, on renvoie le buffer d'origine intact.
 */
export async function cropToPlatform(
  buffer: Buffer,
  preset: string,
  platformId: string | null | undefined
): Promise<Buffer> {
  if (!platformId) return buffer;

  const platform = getPlatformById(preset, platformId);
  if (!platform) return buffer;

  try {
    const metadata = await sharp(buffer).metadata();
    const srcW = metadata.width ?? 0;
    const srcH = metadata.height ?? 0;
    if (srcW === 0 || srcH === 0) return buffer;

    // Si l'image source est plus petite que la cible sur un axe, on conserve le ratio
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
      .jpeg({ quality: 92, progressive: true, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.error(`platform-crop failed for ${platformId}:`, err);
    return buffer;
  }
}
