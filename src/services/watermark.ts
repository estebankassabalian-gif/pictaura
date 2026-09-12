import sharp from "sharp";
import { ARCHIVO_BLACK_BASE64 } from "../assets/archivo-black-base64";

/**
 * Police embarquée en base64 (Archivo Black — même police que le "font-display"
 * du site, licence SIL Open Font, libre de redistribution).
 *
 * Nécessaire car librsvg (moteur SVG de sharp) ne dépend d'aucune police système
 * installée dans le conteneur Docker de prod : un `font-family` non embarqué
 * retomberait sur une police par défaut différente selon l'environnement, ou
 * pire, sur un rendu invisible/à chasse différente. L'ancienne version dessinait
 * les lettres à la main en `<rect>` pour éviter ce problème — mais la lettre
 * "a" avait un tracé bugué (rectangle fermé sur les 4 côtés + barre médiane =
 * se lit visuellement comme un "e") : le wordmark affichait "Picteure" au lieu
 * de "Pictaura" sur CHAQUE photo livrée aux comptes non-abonnés. Police réelle
 * embarquée = orthographe garantie + rendu identique partout, une fois pour toutes.
 *
 * Import d'une constante compilée plutôt qu'un readFileSync : le Dockerfile
 * standalone ne copie PAS src/ brut en prod (seulement .next/standalone +
 * public/ + node_modules) — un readFileSync sur un asset src/ échouerait
 * silencieusement en conteneur alors qu'il marche en local.
 */

/**
 * Génère le badge watermark (icône œil/boussole + wordmark "Pictaura") en SVG.
 * Fond blanc quasi-opaque + ombre portée douce pour rester lisible et se
 * détacher proprement de n'importe quelle photo, sombre ou claire.
 */
function buildWatermarkSvg(w: number, h: number): string {
  // Badge = ~22% de la largeur, min 190px — légèrement réduit vs l'ancienne
  // version (25%) pour un rendu moins envahissant, toujours bien visible.
  const badgeW = Math.max(190, Math.round(w * 0.22));
  const badgeH = Math.round(badgeW * 0.27);
  const margin = Math.round(Math.min(w, h) * 0.025);
  const radius = Math.round(badgeH * 0.22);
  const padX = Math.round(badgeH * 0.22);

  // Icône : occupe la hauteur du badge (moins le padding vertical)
  const iconSize = badgeH - padX * 2;
  const iconScale = iconSize / 64; // viewBox source de l'icône ≈ 64

  const textX = padX + iconSize + Math.round(badgeH * 0.16);
  const fontSize = Math.round(badgeH * 0.44);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <style>
      @font-face {
        font-family: 'Archivo Black Watermark';
        src: url(data:font/ttf;base64,${ARCHIVO_BLACK_BASE64}) format('truetype');
      }
    </style>
    <filter id="badgeShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0A1028" flood-opacity="0.28"/>
    </filter>
  </defs>
  <g transform="translate(${w - badgeW - margin}, ${h - badgeH - margin})" filter="url(#badgeShadow)">
    <rect rx="${radius}" width="${badgeW}" height="${badgeH}" fill="rgba(255,255,255,0.94)"/>
    <!-- Logo mark (œil / boussole) -->
    <g transform="translate(${padX}, ${padX}) scale(${iconScale.toFixed(4)})">
      <path d="M 8 32 L 40 10" stroke="#0A1028" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 8 32 L 40 54" stroke="#0A1028" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 40 10 Q 52 32 40 54" stroke="#0A1028" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <ellipse cx="42" cy="32" rx="9" ry="14" fill="#0A1028"/>
      <line x1="46" y1="14" x2="74" y2="4" stroke="#031D68" stroke-width="5" stroke-linecap="round"/>
      <line x1="52" y1="32" x2="84" y2="32" stroke="#FFC529" stroke-width="5" stroke-linecap="round"/>
      <line x1="46" y1="50" x2="74" y2="60" stroke="#F87005" stroke-width="5" stroke-linecap="round"/>
    </g>
    <!-- "Pictaura" — vraie police embarquée, plus de tracé main hasardeux -->
    <text
      x="${textX}"
      y="${Math.round(badgeH / 2 + fontSize * 0.36)}"
      font-family="Archivo Black Watermark"
      font-size="${fontSize}"
      fill="#031D68"
      letter-spacing="0.5"
    >Pictaura</text>
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
