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

// ─── Pictaura brand colors ──────────────────────────────────────────────────────
const ORANGE = "#f97316"; // primary
const DARK   = "#111827"; // text

// ─── SVG icon (sun/sparkle — scalable) ───────────────────────────────────────
function iconSvg(size) {
  const cx = size / 2;
  const r  = size * 0.25;
  const ray = size * 0.12;
  const gap = size * 0.05;
  const sw  = Math.max(1.5, size * 0.05);
  const o   = cx - r - gap - ray; // ray start (outer)
  const i   = cx - r - gap;       // ray end (inner)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="${ORANGE}"/>
  <circle cx="${cx}" cy="${cx}" r="${r}" fill="white"/>
  <!-- rays -->
  <line x1="${cx}" y1="${o}" x2="${cx}" y2="${i}" stroke="white" stroke-width="${sw}" stroke-linecap="round"/>
  <line x1="${cx}" y1="${size - o}" x2="${cx}" y2="${size - i}" stroke="white" stroke-width="${sw}" stroke-linecap="round"/>
  <line x1="${o}" y1="${cx}" x2="${i}" y2="${cx}" stroke="white" stroke-width="${sw}" stroke-linecap="round"/>
  <line x1="${size - o}" y1="${cx}" x2="${size - i}" y2="${cx}" stroke="white" stroke-width="${sw}" stroke-linecap="round"/>
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
