import sharp from "sharp";

/**
 * Applies a "pictaura.app" watermark to the center of an image.
 * Used for non-subscribed users (freemium model).
 * The watermark is semi-transparent and centered, making it impossible to crop out.
 */
export async function applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 1920;
  const height = metadata.height ?? 1280;

  // Scale watermark text based on image size
  const fontSize = Math.max(Math.round(Math.min(width, height) * 0.06), 24);
  const subFontSize = Math.round(fontSize * 0.45);

  const watermarkSvg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="white" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="white" stop-opacity="0.18"/>
        </linearGradient>
      </defs>
      <g transform="translate(${width / 2}, ${height / 2})" text-anchor="middle">
        <text
          y="-${fontSize * 0.15}"
          font-family="Inter, Arial, sans-serif"
          font-size="${fontSize}"
          font-weight="700"
          fill="url(#wg)"
          letter-spacing="${fontSize * 0.08}"
        >PICTAURA</text>
        <text
          y="${fontSize * 0.7}"
          font-family="Inter, Arial, sans-serif"
          font-size="${subFontSize}"
          font-weight="400"
          fill="url(#wg)"
          letter-spacing="${subFontSize * 0.15}"
        >pictaura.app</text>
      </g>
    </svg>
  `);

  return sharp(imageBuffer)
    .composite([{ input: watermarkSvg, blend: "over" }])
    .toBuffer();
}
