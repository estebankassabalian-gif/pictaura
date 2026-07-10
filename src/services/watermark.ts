import sharp from "sharp";

/**
 * "Pictaura" as SVG path outlines (no font dependency).
 * Designed on a 260×40 viewBox, bold block letters, fill #031D68.
 * Each letter is a simple rect/path — not a real font trace, but reads clearly at any size.
 */
const PICTAURA_TEXT_PATHS = `
  <!-- P -->
  <rect x="0" y="0" width="7" height="40" rx="1" fill="#031D68"/>
  <rect x="7" y="0" width="18" height="7" rx="1" fill="#031D68"/>
  <rect x="7" y="16" width="18" height="7" rx="1" fill="#031D68"/>
  <rect x="22" y="3" width="7" height="17" rx="1" fill="#031D68"/>
  <!-- i -->
  <rect x="36" y="0" width="7" height="7" rx="1" fill="#031D68"/>
  <rect x="36" y="12" width="7" height="28" rx="1" fill="#031D68"/>
  <!-- c -->
  <rect x="50" y="12" width="7" height="28" rx="1" fill="#031D68"/>
  <rect x="57" y="12" width="14" height="7" rx="1" fill="#031D68"/>
  <rect x="57" y="33" width="14" height="7" rx="1" fill="#031D68"/>
  <!-- t -->
  <rect x="78" y="4" width="7" height="36" rx="1" fill="#031D68"/>
  <rect x="72" y="12" width="18" height="7" rx="1" fill="#031D68"/>
  <!-- a -->
  <rect x="97" y="12" width="7" height="28" rx="1" fill="#031D68"/>
  <rect x="104" y="12" width="10" height="7" rx="1" fill="#031D68"/>
  <rect x="104" y="23" width="10" height="7" rx="1" fill="#031D68"/>
  <rect x="104" y="33" width="10" height="7" rx="1" fill="#031D68"/>
  <rect x="111" y="12" width="7" height="28" rx="1" fill="#031D68"/>
  <!-- u -->
  <rect x="125" y="12" width="7" height="28" rx="1" fill="#031D68"/>
  <rect x="132" y="33" width="10" height="7" rx="1" fill="#031D68"/>
  <rect x="139" y="12" width="7" height="28" rx="1" fill="#031D68"/>
  <!-- r -->
  <rect x="153" y="12" width="7" height="28" rx="1" fill="#031D68"/>
  <rect x="160" y="12" width="12" height="7" rx="1" fill="#031D68"/>
  <rect x="169" y="15" width="7" height="10" rx="1" fill="#031D68"/>
  <!-- a -->
  <rect x="183" y="12" width="7" height="28" rx="1" fill="#031D68"/>
  <rect x="190" y="12" width="10" height="7" rx="1" fill="#031D68"/>
  <rect x="190" y="23" width="10" height="7" rx="1" fill="#031D68"/>
  <rect x="190" y="33" width="10" height="7" rx="1" fill="#031D68"/>
  <rect x="197" y="12" width="7" height="28" rx="1" fill="#031D68"/>
`;

/**
 * Génère un watermark SVG avec le logo Pictaura + texte en paths (pas de police requise).
 * Fond semi-transparent pour rester lisible sur n'importe quelle photo.
 */
function buildWatermarkSvg(w: number, h: number): string {
  // Badge = ~25% de la largeur, min 200px
  const badgeW = Math.max(200, Math.round(w * 0.25));
  const badgeH = Math.round(badgeW * 0.28);
  const margin = Math.round(Math.min(w, h) * 0.025);

  // Icon (logo mark) takes ~30% of badge width
  const iconAreaW = Math.round(badgeH * 0.85);
  const iconScale = (badgeH * 0.55) / 64; // logo viewBox is ~84x64

  // Text area starts after icon, scales to fill remaining space
  const textX = iconAreaW;
  const textAvailW = badgeW - iconAreaW - Math.round(badgeH * 0.15);
  const textScale = textAvailW / 204; // text paths viewBox width = 204
  const textH = 40 * textScale;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <g transform="translate(${w - badgeW - margin}, ${h - badgeH - margin})">
    <rect rx="${Math.round(badgeH * 0.18)}" width="${badgeW}" height="${badgeH}" fill="rgba(255,255,255,0.9)"/>
    <!-- Logo mark -->
    <g transform="translate(${Math.round(badgeH * 0.15)}, ${Math.round((badgeH - iconScale * 64) / 2)}) scale(${iconScale.toFixed(4)})">
      <path d="M 8 32 L 40 10" stroke="#0A1028" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 8 32 L 40 54" stroke="#0A1028" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 40 10 Q 52 32 40 54" stroke="#0A1028" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <ellipse cx="42" cy="32" rx="9" ry="14" fill="#0A1028"/>
      <line x1="46" y1="14" x2="74" y2="4" stroke="#031D68" stroke-width="5" stroke-linecap="round"/>
      <line x1="52" y1="32" x2="84" y2="32" stroke="#FFC529" stroke-width="5" stroke-linecap="round"/>
      <line x1="46" y1="50" x2="74" y2="60" stroke="#F87005" stroke-width="5" stroke-linecap="round"/>
    </g>
    <!-- "Pictaura" text as paths (no font needed) -->
    <g transform="translate(${textX}, ${((badgeH - textH) / 2).toFixed(1)}) scale(${textScale.toFixed(4)})">
      ${PICTAURA_TEXT_PATHS}
    </g>
  </g>
</svg>`;
}

/**
 * Applique le badge Pictaura (logo œil + wordmark) en bas à droite de la photo.
 * Appliqué à TOUTES les photos des comptes non-premium (pas d'abonnement actif),
 * pipeline ET inpainting — seuls les abonnés livrent des photos sans badge.
 */
export async function applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 1920;
  const height = metadata.height ?? 1280;

  const svgOverlay = buildWatermarkSvg(width, height);

  return sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
        blend: "over",
      },
    ])
    .toBuffer();
}
