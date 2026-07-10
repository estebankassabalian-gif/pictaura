// Prépare les images de démo du hero landing (vraies photos avant/après villa)
// → public/demo/villa-avant.jpg + villa-apres.jpg (1600px, q80, ~200 Ko)
// Usage : npx tsx scripts/prep-demo-images.ts
import sharp from "sharp";
import { mkdirSync } from "fs";

const SRC = "c:/Users/esteb/n8n-claude/pictaura-refonte-mockup/assets";
const OUT = "public/demo";

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const [src, out] of [
    [`${SRC}/avant.jpg`, `${OUT}/villa-avant.jpg`],
    [`${SRC}/apres.png`, `${OUT}/villa-apres.jpg`],
  ] as const) {
    const buf = await sharp(src)
      .rotate()
      .resize(1600, 900, { fit: "cover" })
      .jpeg({ quality: 80, mozjpeg: true, progressive: true })
      .toBuffer();
    await sharp(buf).toFile(out);
    console.log(`${out} : ${(buf.length / 1024).toFixed(0)} Ko`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
