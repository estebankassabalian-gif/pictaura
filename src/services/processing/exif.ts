import sharp from "sharp";

interface ExifData {
  altText?: string;
  seoFileName?: string;
  description?: string;
  keywords?: string;
  preset?: string;
}

/**
 * Injecte les métadonnées SEO dans les champs EXIF du fichier image.
 *
 * Champs écrits :
 * - ImageDescription → lu par Google Images, Shopify, WordPress à l'import
 * - XPTitle          → titre de l'image (Windows / logiciels photo)
 * - XPKeywords       → mots-clés (Lightroom, Capture One, WooCommerce)
 * - Copyright        → branding Pictaura
 * - Software         → traçabilité
 *
 * Non-destructif : si l'injection échoue, le buffer original est retourné.
 */
/** Retire les balises HTML et les caractères de contrôle d'une chaîne */
function sanitizeExif(value: string, maxLen = 255): string {
  return value
    .replace(/<[^>]*>/g, "")          // strip HTML tags
    .replace(/[\x00-\x1F\x7F]/g, " ") // strip control chars
    .trim()
    .slice(0, maxLen);
}

export async function injectExifMetadata(
  imageBuffer: Buffer,
  data: ExifData
): Promise<Buffer> {
  try {
    const description = sanitizeExif(data.altText || data.description || "");
    const title = sanitizeExif((data.seoFileName || "").replace(/\.jpg$/i, "").replace(/-/g, " "));

    // Keywords : dé-sérialiser si JSON array
    let keywordsStr = "";
    try {
      const kw = data.keywords ? JSON.parse(data.keywords) : [];
      keywordsStr = Array.isArray(kw) ? kw.join(";") : String(data.keywords ?? "");
    } catch {
      keywordsStr = data.keywords ?? "";
    }

    // Sharp IFD0 EXIF fields
    const exifFields: Record<string, string> = {};
    if (description) exifFields.ImageDescription = description;
    if (title) exifFields.XPTitle = title;
    if (keywordsStr) exifFields.XPKeywords = keywordsStr;
    exifFields.Copyright = "pictaura.app";
    exifFields.Software = "Pictaura IA";
    if (data.preset) exifFields.XPComment = `Optimisé pour ${data.preset} par Pictaura`;

    return await sharp(imageBuffer)
      .withMetadata({
        exif: {
          IFD0: exifFields,
        },
      })
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch (err) {
    // Non-bloquant : si l'injection EXIF échoue, on retourne l'image originale
    console.error("EXIF injection warning (non-blocking):", err);
    return imageBuffer;
  }
}
