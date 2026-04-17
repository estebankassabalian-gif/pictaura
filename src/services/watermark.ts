import sharp from "sharp";

/**
 * Génère un watermark SVG avec le logo Pictaura + texte en couleurs de la marque.
 * Fond semi-transparent pour rester lisible sur n'importe quelle photo.
 */
function buildWatermarkSvg(w: number, h: number): string {
  // Taille adaptée à l'image (environ 22% de la largeur, min 180px)
  const badgeW = Math.max(180, Math.round(w * 0.22));
  const badgeH = Math.round(badgeW * 0.32);
  const fontSize = Math.round(badgeW * 0.22);
  const iconScale = badgeH * 0.55;
  const margin = Math.round(Math.min(w, h) * 0.025);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="1" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.4"/>
    </filter>
  </defs>
  <g transform="translate(${w - badgeW - margin}, ${h - badgeH - margin})" filter="url(#shadow)">
    <rect rx="${Math.round(badgeH * 0.2)}" width="${badgeW}" height="${badgeH}" fill="rgba(255,255,255,0.88)"/>
    <g transform="translate(${Math.round(badgeH * 0.18)}, ${Math.round((badgeH - iconScale) / 2)}) scale(${(iconScale / 64).toFixed(3)})">
      <path d="M 8 32 L 40 10" stroke="#0A1028" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 8 32 L 40 54" stroke="#0A1028" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 40 10 Q 52 32 40 54" stroke="#0A1028" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <ellipse cx="42" cy="32" rx="9" ry="14" fill="#0A1028"/>
      <line x1="46" y1="14" x2="74" y2="4" stroke="#031D68" stroke-width="5" stroke-linecap="round"/>
      <line x1="52" y1="32" x2="84" y2="32" stroke="#FFC529" stroke-width="5" stroke-linecap="round"/>
      <line x1="46" y1="50" x2="74" y2="60" stroke="#F87005" stroke-width="5" stroke-linecap="round"/>
    </g>
    <text x="${Math.round(badgeH * 0.18 + iconScale * 1.35)}" y="${Math.round(badgeH * 0.62)}"
      font-family="Arial Black, Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="900"
      fill="#031D68" letter-spacing="-0.3">Pictaura</text>
  </g>
</svg>`;
}

/**
 * Applique le badge Pictaura en bas à droite de la photo.
 * Réservé aux 5 retouches offertes à l'inscription (freemium).
 * Badge blanc semi-transparent avec logo couleur + texte "Pictaura" — bien visible.
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
