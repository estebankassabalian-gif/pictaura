import sharp from "sharp";

interface ExifData {
  altText?: string;
  seoFileName?: string;
  description?: string;
  keywords?: string;
  preset?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Construit un paquet XMP (Dublin Core) lu nativement par Lightroom, Photoshop,
 * WordPress (plugin Image SEO), Shopify (app metadata) et Google Images.
 * Les CMS modernes privilégient XMP sur IPTC/EXIF pour l'import auto.
 */
const XMP_NAMESPACE = "http://ns.adobe.com/xap/1.0/\0";

/**
 * Injecte un segment APP1 XMP dans un buffer JPEG, juste après le marqueur
 * SOI (0xFFD8). Non-destructif : si le buffer n'est pas un JPEG valide ou
 * si le XMP dépasse 65 500 octets, renvoie le buffer d'origine.
 */
function injectXmpApp1(jpegBuffer: Buffer, xmpPacket: string): Buffer {
  // SOI marker check
  if (jpegBuffer.length < 4 || jpegBuffer[0] !== 0xff || jpegBuffer[1] !== 0xd8) {
    return jpegBuffer;
  }

  const nsBuffer = Buffer.from(XMP_NAMESPACE, "binary");
  const xmpBuffer = Buffer.from(xmpPacket, "utf8");
  const payload = Buffer.concat([nsBuffer, xmpBuffer]);

  // APP1 length = 2 (length field) + payload. Max 65535.
  const segLength = 2 + payload.length;
  if (segLength > 65535) {
    console.warn("XMP packet too large for single APP1 segment, skipping");
    return jpegBuffer;
  }

  const marker = Buffer.from([0xff, 0xe1, (segLength >> 8) & 0xff, segLength & 0xff]);
  // Insert after SOI (first 2 bytes)
  return Buffer.concat([jpegBuffer.subarray(0, 2), marker, payload, jpegBuffer.subarray(2)]);
}

function buildXmpPacket(data: {
  title: string;
  description: string;
  keywords: string[];
}): string {
  const title = escapeXml(data.title);
  const description = escapeXml(data.description);
  const subjects = data.keywords
    .map((k) => `          <rdf:li>${escapeXml(k)}</rdf:li>`)
    .join("\n");

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Pictaura 1.0">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/">
      <dc:title>
        <rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt>
      </dc:title>
      <dc:description>
        <rdf:Alt><rdf:li xml:lang="x-default">${description}</rdf:li></rdf:Alt>
      </dc:description>
      <dc:creator><rdf:Seq><rdf:li>Pictaura</rdf:li></rdf:Seq></dc:creator>
      <dc:rights>
        <rdf:Alt><rdf:li xml:lang="x-default">pictaura.app</rdf:li></rdf:Alt>
      </dc:rights>
      <dc:subject>
        <rdf:Bag>
${subjects}
        </rdf:Bag>
      </dc:subject>
      <xmp:CreatorTool>Pictaura IA</xmp:CreatorTool>
      <xmpRights:Marked>True</xmpRights:Marked>
      <xmpRights:WebStatement>https://pictaura.app/licence</xmpRights:WebStatement>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
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

    // Keywords array pour XMP dc:subject
    let keywordArray: string[] = [];
    try {
      const kw = data.keywords ? JSON.parse(data.keywords) : [];
      keywordArray = Array.isArray(kw) ? kw.map(String) : [];
    } catch {
      keywordArray = keywordsStr ? keywordsStr.split(/[;,]/).map((s) => s.trim()).filter(Boolean) : [];
    }

    const xmpPacket = buildXmpPacket({
      title,
      description,
      keywords: keywordArray,
    });

    // Sharp 0.33 n'expose pas withMetadata({ xmp }), on injecte l'APP1 XMP
    // à la main après coup — c'est du JPEG standard lu par Lightroom, Shopify,
    // WordPress et Google Images.
    const jpegWithExif = await sharp(imageBuffer)
      .withMetadata({ exif: { IFD0: exifFields } })
      .jpeg({ quality: 92 })
      .toBuffer();

    return injectXmpApp1(jpegWithExif, xmpPacket);
  } catch (err) {
    // Non-bloquant : si l'injection EXIF échoue, on retourne l'image originale
    console.error("EXIF injection warning (non-blocking):", err);
    return imageBuffer;
  }
}
