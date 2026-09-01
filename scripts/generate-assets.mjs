/**
 * Generates all required public assets for Pictaura:
 * - favicon.ico (multi-size)
 * - favicon-16x16.png
 * - favicon-32x32.png
 * - apple-touch-icon.png (180x180)
 * - android-chrome-192x192.png
 * - android-chrome-512x512.png
 * - logo.png (400x120)
 * - og-image.jpg (1200x630)
 *
 * Run: node scripts/generate-assets.mjs
 * Requires: npm install sharp (already in project deps)
 */

import sharp from "sharp";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "../public");

// ─── Pictaura brand colors (v2 — cream/navy/orange) ─────────────────────────
const ORANGE = "#F87005"; // accent
const DARK   = "#031D68"; // navy ink
const CREAM  = "#FFFBF5"; // background

// ─── SVG icon — Pictaura mark (triangle + iris + 3 rays) ────────────────────
// Reprend le design de public/logo-mark.svg, adapté carré pour PWA.
//
// maskable: true génère une variante conforme à la norme W3C maskable icons —
// l'OS (Android, etc.) applique SON PROPRE masque (cercle, squircle...) par
// dessus l'icône, donc : (1) fond plein SANS coins arrondis pré-cuits (les
// coins arrondis de la variante normale entreraient en double avec le masque
// OS), (2) le glyphe doit tenir dans la "safe zone" — un cercle centré
// couvrant ~80% de l'icône — sinon l'OS le rogne. Le glyphe normal déborde
// jusqu'à x=92/y=86 (marge insuffisante et asymétrique) : on le recentre et
// le réduit via un <g transform> plutôt que de recalculer chaque coordonnée.
function iconSvg(size, { maskable = false } = {}) {
  const sw = Math.max(1.8, size * 0.055);
  const s = size / 100;
  const x = (n) => n * s;

  const background = maskable
    ? `<rect width="${size}" height="${size}" fill="${CREAM}"/>`
    : `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${CREAM}"/>`;

  // Glyphe original ≈ bounding box [18,92]×[14,86] (centre ~55,50) — MAIS déjà
  // exprimé en pixels finaux via x(n)=n*s, pas en 0-100 normalisé. Le pivot de
  // la transformation doit donc lui aussi être en pixels (x(50), x(55)...),
  // pas en unités brutes 0-100 (bug du premier essai : glyphe collé en haut à
  // gauche au lieu d'être centré, un icône 512px utilisant translate(50,50)
  // au lieu de translate(256,256)).
  const glyphOpen = maskable
    ? `<g transform="translate(${x(50)},${x(50)}) scale(0.65) translate(${-x(55)},${-x(50)})">`
    : "";
  const glyphClose = maskable ? `</g>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  ${background}
  ${glyphOpen}
  <!-- Triangle (top edge) -->
  <path d="M ${x(18)} ${x(50)} L ${x(45)} ${x(20)}" stroke="${DARK}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M ${x(18)} ${x(50)} L ${x(45)} ${x(80)}" stroke="${DARK}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M ${x(45)} ${x(20)} Q ${x(58)} ${x(50)} ${x(45)} ${x(80)}" stroke="${DARK}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <!-- Iris -->
  <ellipse cx="${x(47)}" cy="${x(50)}" rx="${x(9)}" ry="${x(14)}" fill="${DARK}"/>
  <!-- 3 rays -->
  <line x1="${x(52)}" y1="${x(26)}" x2="${x(82)}" y2="${x(14)}" stroke="${DARK}" stroke-width="${sw}" stroke-linecap="round"/>
  <line x1="${x(58)}" y1="${x(50)}" x2="${x(92)}" y2="${x(50)}" stroke="#FFC529" stroke-width="${sw}" stroke-linecap="round"/>
  <line x1="${x(52)}" y1="${x(74)}" x2="${x(82)}" y2="${x(86)}" stroke="${ORANGE}" stroke-width="${sw}" stroke-linecap="round"/>
  ${glyphClose}
</svg>`;
}

// ─── OG image SVG (1200×630) ─────────────────────────────────────────────────
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <!-- Background gradient -->
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff7ed"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <linearGradient id="badge" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#fb923c"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Decorative circles -->
  <circle cx="1100" cy="80" r="200" fill="#f97316" opacity="0.06"/>
  <circle cx="50" cy="580" r="150" fill="#f97316" opacity="0.04"/>

  <!-- Logo icon -->
  <rect x="80" y="80" width="72" height="72" rx="16" fill="${ORANGE}"/>
  <circle cx="116" cy="116" r="16" fill="white"/>
  <line x1="116" y1="90" x2="116" y2="100" stroke="white" stroke-width="4" stroke-linecap="round"/>
  <line x1="116" y1="132" x2="116" y2="142" stroke="white" stroke-width="4" stroke-linecap="round"/>
  <line x1="90" y1="116" x2="100" y2="116" stroke="white" stroke-width="4" stroke-linecap="round"/>
  <line x1="132" y1="116" x2="142" y2="116" stroke="white" stroke-width="4" stroke-linecap="round"/>

  <!-- Wordmark -->
  <text x="168" y="132" font-family="system-ui,-apple-system,sans-serif" font-size="48" font-weight="700" fill="${DARK}">Pictaura</text>

  <!-- Headline -->
  <text x="80" y="270" font-family="system-ui,-apple-system,sans-serif" font-size="62" font-weight="800" fill="${DARK}">Retouche photo IA</text>
  <text x="80" y="350" font-family="system-ui,-apple-system,sans-serif" font-size="62" font-weight="800" fill="${ORANGE}">pour Airbnb, Vinted &amp; Instagram</text>

  <!-- Subtitle -->
  <text x="80" y="430" font-family="system-ui,-apple-system,sans-serif" font-size="30" fill="#6b7280">Vos photos optimisées en 30 secondes par l&#39;IA.</text>

  <!-- Badge -->
  <rect x="80" y="490" width="260" height="52" rx="26" fill="url(#badge)"/>
  <text x="210" y="522" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="600" fill="white" text-anchor="middle">5 crédits gratuits</text>

  <!-- Platform pills -->
  <rect x="370" y="490" width="120" height="52" rx="26" fill="#f3f4f6"/>
  <text x="430" y="522" font-family="system-ui,-apple-system,sans-serif" font-size="18" fill="#374151" text-anchor="middle">Airbnb</text>
  <rect x="506" y="490" width="120" height="52" rx="26" fill="#f3f4f6"/>
  <text x="566" y="522" font-family="system-ui,-apple-system,sans-serif" font-size="18" fill="#374151" text-anchor="middle">Vinted</text>
  <rect x="642" y="490" width="150" height="52" rx="26" fill="#f3f4f6"/>
  <text x="717" y="522" font-family="system-ui,-apple-system,sans-serif" font-size="18" fill="#374151" text-anchor="middle">Instagram</text>
  <rect x="808" y="490" width="130" height="52" rx="26" fill="#f3f4f6"/>
  <text x="873" y="522" font-family="system-ui,-apple-system,sans-serif" font-size="18" fill="#374151" text-anchor="middle">Shopify</text>

  <!-- Domain -->
  <text x="1120" y="600" font-family="system-ui,-apple-system,sans-serif" font-size="22" fill="#9ca3af" text-anchor="end">pictaura.app</text>
</svg>`;

async function generate() {
  console.log("Generating Pictaura public assets...\n");

  // Favicon sizes
  const faviconSizes = [16, 32, 180, 192, 512];
  const faviconFiles = {
    16:  "favicon-16x16.png",
    32:  "favicon-32x32.png",
    180: "apple-touch-icon.png",
    192: "android-chrome-192x192.png",
    512: "android-chrome-512x512.png",
  };

  for (const size of faviconSizes) {
    const svg = Buffer.from(iconSvg(size));
    const outPath = join(PUBLIC, faviconFiles[size]);
    await sharp(svg).png().toFile(outPath);
    console.log(`✓ ${faviconFiles[size]} (${size}×${size})`);
  }

  // Icônes maskable (PWA manifest.ts, purpose: "maskable") — 192/512 uniquement,
  // ce sont les seules tailles utiles pour l'installation d'app.
  for (const size of [192, 512]) {
    const svg = Buffer.from(iconSvg(size, { maskable: true }));
    const outPath = join(PUBLIC, `android-chrome-${size}x${size}-maskable.png`);
    await sharp(svg).png().toFile(outPath);
    console.log(`✓ android-chrome-${size}x${size}-maskable.png (${size}×${size})`);
  }

  // favicon.ico — use 32×32 PNG renamed (browsers accept PNG-based ICO via link tag)
  // For a real multi-size .ico, use the `ico-endec` package; for now copy 32px PNG
  const ico32 = await sharp(Buffer.from(iconSvg(32))).png().toBuffer();
  writeFileSync(join(PUBLIC, "favicon.ico"), ico32);
  console.log("✓ favicon.ico (32×32 PNG-encoded)");

  // logo.png (400×120, transparent background)
  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120" width="400" height="120">
    <rect x="10" y="10" width="100" height="100" rx="20" fill="${ORANGE}"/>
    <circle cx="60" cy="60" r="22" fill="white"/>
    <line x1="60" y1="20" x2="60" y2="36" stroke="white" stroke-width="6" stroke-linecap="round"/>
    <line x1="60" y1="84" x2="60" y2="100" stroke="white" stroke-width="6" stroke-linecap="round"/>
    <line x1="20" y1="60" x2="36" y2="60" stroke="white" stroke-width="6" stroke-linecap="round"/>
    <line x1="84" y1="60" x2="100" y2="60" stroke="white" stroke-width="6" stroke-linecap="round"/>
    <text x="130" y="78" font-family="system-ui,-apple-system,sans-serif" font-size="56" font-weight="700" fill="${DARK}">Pictaura</text>
  </svg>`;
  await sharp(Buffer.from(logoSvg)).png().toFile(join(PUBLIC, "logo.png"));
  console.log("✓ logo.png (400×120)");

  // og-image.jpg (1200×630)
  await sharp(Buffer.from(ogSvg))
    .jpeg({ quality: 90, progressive: true })
    .toFile(join(PUBLIC, "og-image.jpg"));
  console.log("✓ og-image.jpg (1200×630)");

  console.log("\nAll assets generated in public/");
}

generate().catch(console.error);
