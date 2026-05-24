interface ExifData {
  altText?: string;
  seoFileName?: string;
  description?: string;
  keywords?: string;
  metaTitle?: string;
  hashtags?: string;
  schemaJsonLd?: string;
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

// ============================================================================
// Byte-level EXIF + XMP APP1 injection — NO JPEG re-encode, preserves pixel fidelity
// ============================================================================
//
// Sharp's `withMetadata({ exif })` requires going through Sharp's pipeline which
// always re-encodes the JPEG → small but cumulative quality loss. By writing the
// APP1 segments directly into the JPEG byte stream we keep the original pixel
// data 100% intact and only add metadata to the file header.
//
// JPEG segment layout (from start of file):
//   0xFFD8 (SOI)
//   [APP0 JFIF segment if present — kept verbatim]
//   [APP1 EXIF segment — we replace]
//   [APP1 XMP segment — we replace]
//   ...quantization tables, scan data, etc... (untouched, pixels preserved)
//   0xFFD9 (EOI)

const EXIF_HEADER = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif\0\0"
const TIFF_HEADER_LE = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]); // "II" + 0x2A00 + offset=8
const XMP_NAMESPACE = "http://ns.adobe.com/xap/1.0/\0";

interface IfdEntry {
  tag: number;
  type: 1 | 2; // 1=BYTE (used for Windows XP* UTF-16LE strings), 2=ASCII (NUL-terminated)
  data: Buffer; // raw bytes for the value (will go inline if ≤4 bytes, else in data area)
}

function asciiZ(str: string): Buffer {
  // ASCII NUL-terminated. Drop non-ASCII to avoid invalid UTF-8 in pure-ASCII tag.
  const clean = str.replace(/[^\x20-\x7E]/g, "");
  return Buffer.concat([Buffer.from(clean, "ascii"), Buffer.from([0])]);
}

function utf16leZ(str: string): Buffer {
  // Windows XP* tags: UTF-16LE, NUL-terminated (2-byte NUL).
  return Buffer.concat([Buffer.from(str, "utf16le"), Buffer.from([0, 0])]);
}

/**
 * Build a TIFF/IFD0 byte stream from the given entries.
 * Layout: TIFF header (8 bytes) | IFD entry count (2) | entries (12 × N) | next IFD offset (4) | data area
 */
function buildTiffIfd0(entries: IfdEntry[]): Buffer {
  // IFD0 spec requires entries sorted by tag ID
  entries.sort((a, b) => a.tag - b.tag);

  const count = entries.length;
  const ifdHeaderSize = 2 + count * 12 + 4; // count field + entries + next-IFD offset
  // Data area offsets are relative to start of TIFF (i.e. start of TIFF_HEADER_LE).
  // TIFF header is 8 bytes, then IFD0, then data.
  let dataOffset = 8 + ifdHeaderSize;

  const ifdBuf = Buffer.alloc(ifdHeaderSize);
  const dataChunks: Buffer[] = [];

  ifdBuf.writeUInt16LE(count, 0);
  let pos = 2;
  for (const entry of entries) {
    ifdBuf.writeUInt16LE(entry.tag, pos);
    ifdBuf.writeUInt16LE(entry.type, pos + 2);
    ifdBuf.writeUInt32LE(entry.data.length, pos + 4);

    if (entry.data.length <= 4) {
      // Inline value, zero-padded
      const inline = Buffer.alloc(4);
      entry.data.copy(inline);
      inline.copy(ifdBuf, pos + 8);
    } else {
      ifdBuf.writeUInt32LE(dataOffset, pos + 8);
      dataChunks.push(entry.data);
      // Word-align data area (TIFF requires offsets at even byte boundaries)
      if (entry.data.length % 2 === 1) {
        dataChunks.push(Buffer.from([0]));
        dataOffset += 1;
      }
      dataOffset += entry.data.length;
    }
    pos += 12;
  }
  // Next IFD offset = 0 (no IFD1)
  ifdBuf.writeUInt32LE(0, pos);

  return Buffer.concat([TIFF_HEADER_LE, ifdBuf, ...dataChunks]);
}

/** Wrap TIFF data in an APP1 EXIF segment marker. Returns empty if too large. */
function buildExifApp1Segment(tiffData: Buffer): Buffer {
  const payload = Buffer.concat([EXIF_HEADER, tiffData]);
  const segLength = 2 + payload.length; // 2 = length field itself
  if (segLength > 65535) {
    console.warn("EXIF segment too large for single APP1, skipping");
    return Buffer.alloc(0);
  }
  const marker = Buffer.from([0xff, 0xe1, (segLength >> 8) & 0xff, segLength & 0xff]);
  return Buffer.concat([marker, payload]);
}

/** Build XMP APP1 segment (Adobe XMP wrapped in APP1). */
function buildXmpApp1Segment(xmpPacket: string): Buffer {
  const payload = Buffer.concat([
    Buffer.from(XMP_NAMESPACE, "binary"),
    Buffer.from(xmpPacket, "utf8"),
  ]);
  const segLength = 2 + payload.length;
  if (segLength > 65535) {
    console.warn("XMP packet too large for single APP1, skipping");
    return Buffer.alloc(0);
  }
  const marker = Buffer.from([0xff, 0xe1, (segLength >> 8) & 0xff, segLength & 0xff]);
  return Buffer.concat([marker, payload]);
}

/**
 * Remove any existing APP1 (EXIF or XMP) segments from a JPEG without re-encoding.
 * Walks the segment list, copies non-APP1 segments verbatim, drops APP1, and copies
 * the scan data (SOS onward) byte-for-byte. Pixel data is never touched.
 */
function stripExistingApp1(jpegBuffer: Buffer): Buffer {
  if (jpegBuffer.length < 4 || jpegBuffer[0] !== 0xff || jpegBuffer[1] !== 0xd8) {
    return jpegBuffer;
  }

  const out: Buffer[] = [Buffer.from([0xff, 0xd8])]; // SOI
  let pos = 2;
  while (pos < jpegBuffer.length - 1) {
    if (jpegBuffer[pos] !== 0xff) break;
    const marker = jpegBuffer[pos + 1];

    // SOS = start of scan; rest of file is image data, copy verbatim
    if (marker === 0xda) {
      out.push(jpegBuffer.subarray(pos));
      return Buffer.concat(out);
    }

    // Standalone markers without length: RST0-RST7 (0xD0-0xD7), SOI, EOI, TEM
    if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      out.push(jpegBuffer.subarray(pos, pos + 2));
      pos += 2;
      continue;
    }

    // Segments with 2-byte big-endian length
    if (pos + 4 > jpegBuffer.length) break;
    const segLen = jpegBuffer.readUInt16BE(pos + 2);
    if (segLen < 2 || pos + 2 + segLen > jpegBuffer.length) break;

    if (marker === 0xe1) {
      // Drop APP1 (existing EXIF or XMP — we'll re-insert our own)
      pos += 2 + segLen;
    } else {
      out.push(jpegBuffer.subarray(pos, pos + 2 + segLen));
      pos += 2 + segLen;
    }
  }
  return Buffer.concat(out);
}

/**
 * Inject EXIF (IFD0) + XMP into a JPEG byte stream without re-encoding pixels.
 * Returns a new buffer with the same image data but updated metadata.
 */
function injectMetadataApp1(
  jpegBuffer: Buffer,
  exifFields: { description?: string; software?: string; copyright?: string; xpTitle?: string; xpKeywords?: string; xpComment?: string },
  xmpPacket: string
): Buffer {
  if (jpegBuffer.length < 4 || jpegBuffer[0] !== 0xff || jpegBuffer[1] !== 0xd8) {
    return jpegBuffer;
  }

  // Standard EXIF tag IDs
  const TAG = {
    ImageDescription: 0x010e,
    Software:         0x0131,
    Copyright:        0x8298,
    XPTitle:          0x9c9b,
    XPComment:        0x9c9c,
    XPKeywords:       0x9c9e,
  };

  const entries: IfdEntry[] = [];
  if (exifFields.description) entries.push({ tag: TAG.ImageDescription, type: 2, data: asciiZ(exifFields.description) });
  if (exifFields.software)    entries.push({ tag: TAG.Software,         type: 2, data: asciiZ(exifFields.software) });
  if (exifFields.copyright)   entries.push({ tag: TAG.Copyright,        type: 2, data: asciiZ(exifFields.copyright) });
  if (exifFields.xpTitle)     entries.push({ tag: TAG.XPTitle,          type: 1, data: utf16leZ(exifFields.xpTitle) });
  if (exifFields.xpComment)   entries.push({ tag: TAG.XPComment,        type: 1, data: utf16leZ(exifFields.xpComment) });
  if (exifFields.xpKeywords)  entries.push({ tag: TAG.XPKeywords,       type: 1, data: utf16leZ(exifFields.xpKeywords) });

  const exifApp1 = entries.length > 0 ? buildExifApp1Segment(buildTiffIfd0(entries)) : Buffer.alloc(0);
  const xmpApp1 = xmpPacket ? buildXmpApp1Segment(xmpPacket) : Buffer.alloc(0);

  const stripped = stripExistingApp1(jpegBuffer);
  // Insert EXIF first (convention: EXIF before XMP), then XMP, right after SOI
  return Buffer.concat([
    stripped.subarray(0, 2), // SOI
    exifApp1,
    xmpApp1,
    stripped.subarray(2),    // everything after SOI (APP0 JFIF, DQT, DHT, scan data...)
  ]);
}

function buildXmpPacket(data: {
  title: string;
  description: string;
  altText: string;
  keywords: string[];
  metaTitle: string;
  hashtags: string;
  schemaJsonLd: string;
  preset: string;
}): string {
  const title = escapeXml(data.title);
  const description = escapeXml(data.description);
  const altText = escapeXml(data.altText);
  const metaTitle = escapeXml(data.metaTitle);
  const hashtags = escapeXml(data.hashtags);
  const preset = escapeXml(data.preset);
  const schema = escapeXml(data.schemaJsonLd);
  const subjects = data.keywords
    .map((k) => `          <rdf:li>${escapeXml(k)}</rdf:li>`)
    .join("\n");

  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Pictaura 1.0">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"
      xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"
      xmlns:pictaura="https://pictaura.app/ns/1.0/">
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
      <Iptc4xmpCore:AltTextAccessibility>
        <rdf:Alt><rdf:li xml:lang="x-default">${altText}</rdf:li></rdf:Alt>
      </Iptc4xmpCore:AltTextAccessibility>
      <xmp:CreatorTool>Pictaura IA</xmp:CreatorTool>
      <xmp:Label>${preset}</xmp:Label>
      <xmpRights:Marked>True</xmpRights:Marked>
      <xmpRights:WebStatement>https://pictaura.app/licence</xmpRights:WebStatement>
      <pictaura:preset>${preset}</pictaura:preset>
      <pictaura:altText>${altText}</pictaura:altText>
      <pictaura:metaTitle>${metaTitle}</pictaura:metaTitle>
      <pictaura:hashtags>${hashtags}</pictaura:hashtags>
      <pictaura:schemaJsonLd>${schema}</pictaura:schemaJsonLd>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function sanitizeExif(value: string, maxLen = 255): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Injecte les métadonnées SEO dans le fichier JPEG :
 * - EXIF IFD0 (ImageDescription, XPTitle, XPKeywords, XPComment, Copyright, Software)
 * - XMP Dublin Core + IPTC + namespace custom pictaura: (avec JSON-LD complet)
 *
 * Implémentation byte-level — AUCUN ré-encodage JPEG, qualité des pixels préservée
 * à 100% par rapport au buffer d'entrée. Si l'injection échoue pour une raison
 * quelconque, le buffer d'entrée est retourné intact.
 */
export async function injectExifMetadata(
  imageBuffer: Buffer,
  data: ExifData
): Promise<Buffer> {
  try {
    const altText = sanitizeExif(data.altText || "", 500);
    const description = sanitizeExif(data.altText || data.description || "", 500);
    const title = sanitizeExif(
      data.metaTitle || (data.seoFileName || "").replace(/\.jpg$/i, "").replace(/-/g, " "),
      255
    );
    const metaTitle = sanitizeExif(data.metaTitle || "", 255);
    const hashtags = sanitizeExif(data.hashtags || "", 600);

    // Keywords : dé-sérialiser si JSON array
    let keywordsStr = "";
    try {
      const kw = data.keywords ? JSON.parse(data.keywords) : [];
      keywordsStr = Array.isArray(kw) ? kw.join(";") : String(data.keywords ?? "");
    } catch {
      keywordsStr = data.keywords ?? "";
    }

    let keywordArray: string[] = [];
    try {
      const kw = data.keywords ? JSON.parse(data.keywords) : [];
      keywordArray = Array.isArray(kw) ? kw.map(String) : [];
    } catch {
      keywordArray = keywordsStr ? keywordsStr.split(/[;,]/).map((s) => s.trim()).filter(Boolean) : [];
    }

    let schemaCompact = "";
    if (data.schemaJsonLd) {
      try {
        schemaCompact = JSON.stringify(JSON.parse(data.schemaJsonLd));
      } catch {
        schemaCompact = "";
      }
    }

    const xmpPacket = buildXmpPacket({
      title,
      description,
      altText,
      keywords: keywordArray,
      metaTitle,
      hashtags,
      schemaJsonLd: schemaCompact,
      preset: data.preset || "",
    });

    return injectMetadataApp1(
      imageBuffer,
      {
        description,
        software: "Pictaura IA",
        copyright: "pictaura.app",
        xpTitle: title,
        xpComment: data.preset ? `Optimise pour ${data.preset} par Pictaura` : undefined,
        xpKeywords: keywordsStr,
      },
      xmpPacket
    );
  } catch (err) {
    console.error("EXIF injection warning (non-blocking):", err);
    return imageBuffer;
  }
}
