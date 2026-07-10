// Vérification visuelle du watermark (compte gratuit).
// Lance : npx tsx scripts/test-watermark.ts
// Produit scripts/watermark-test-output.jpg avec le badge Pictaura appliqué.
import sharp from "sharp";
import { writeFileSync } from "fs";
import { applyWatermark } from "../src/services/watermark";

async function main() {
  // Image test type "photo" : dégradé bleu-gris 1600x1000 (pour voir le badge blanc).
  const base = await sharp({
    create: {
      width: 1600,
      height: 1000,
      channels: 3,
      background: { r: 70, g: 110, b: 150 },
    },
  })
    .jpeg()
    .toBuffer();

  const watermarked = await applyWatermark(base);
  writeFileSync("scripts/watermark-test-output.jpg", watermarked);
  console.log(`OK — watermark appliqué, ${(watermarked.length / 1024).toFixed(0)} Ko`);
}

main().catch((e) => {
  console.error("ÉCHEC:", e);
  process.exit(1);
});
