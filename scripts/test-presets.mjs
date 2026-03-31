/**
 * Script de test des 4 pipelines de retouche photo
 * Usage : node scripts/test-presets.mjs
 *
 * Télécharge une photo de test, lance chaque pipeline, et vérifie le résultat.
 */

import { createRequire } from "module";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Charger les variables d'environnement
import { config } from "dotenv";
config({ path: join(__dirname, "../.env.local") });

// Vérifications des variables d'environnement critiques
const REQUIRED_ENV = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "REPLICATE_API_TOKEN",
  "OPENAI_API_KEY",
];

console.log("\n=== PICTAURA — Test des 4 presets ===\n");

console.log("📋 Vérification des variables d'environnement...");
let envOk = true;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.log(`  ❌ ${key} manquant`);
    envOk = false;
  } else {
    const val = process.env[key];
    const masked = val.slice(0, 4) + "..." + val.slice(-4);
    console.log(`  ✅ ${key} = ${masked}`);
  }
}

if (!envOk) {
  console.log("\n❌ Variables manquantes — impossible de continuer.\n");
  process.exit(1);
}

// Télécharger une image de test (photo de chambre Unsplash)
async function downloadTestImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadTestImage(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

// Test d'un preset via l'API locale
async function testViaAPI(preset, imageBuffer) {
  // On va appeler directement les fonctions sharp localement
  // sans passer par l'API (pas de serveur requis)
  const sharp = require("sharp");

  const meta = await sharp(imageBuffer).metadata();
  return {
    inputWidth: meta.width,
    inputHeight: meta.height,
    inputSize: imageBuffer.length,
  };
}

async function main() {
  // ─── 1. Téléchargement image de test ───────────────────────────
  console.log("\n📥 Téléchargement de l'image de test...");
  // Photo de chambre (Airbnb-style) — Unsplash (libre de droits, petite taille)
  const TEST_IMAGE_URL =
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1280&q=80&auto=format&fit=crop";

  let imageBuffer;
  try {
    imageBuffer = await downloadTestImage(TEST_IMAGE_URL);
    console.log(`  ✅ Image téléchargée : ${(imageBuffer.length / 1024).toFixed(0)} KB`);

    // Sauvegarder l'image originale
    const outputDir = join(__dirname, "../test-output");
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, "original.jpg"), imageBuffer);
    console.log(`  💾 Sauvegardée dans test-output/original.jpg`);
  } catch (err) {
    console.log(`  ❌ Échec téléchargement : ${err.message}`);
    console.log("  ℹ️  Utilisation d'une image générée localement...");

    // Générer une image test avec Sharp
    const sharp = require("sharp");
    imageBuffer = await sharp({
      create: {
        width: 1280,
        height: 960,
        channels: 3,
        background: { r: 100, g: 150, b: 200 },
      },
    })
      .jpeg({ quality: 80 })
      .toBuffer();
    console.log(`  ✅ Image synthétique générée : ${(imageBuffer.length / 1024).toFixed(0)} KB`);
  }

  // ─── 2. Vérification Sharp ──────────────────────────────────────
  console.log("\n🔧 Test Sharp (local — sans Replicate)...");
  try {
    const sharp = require("sharp");
    const meta = await sharp(imageBuffer).metadata();
    console.log(`  ✅ Sharp OK — Image : ${meta.width}×${meta.height} px, format: ${meta.format}`);
  } catch (err) {
    console.log(`  ❌ Sharp échoué : ${err.message}`);
    process.exit(1);
  }

  // ─── 3. Test R2 ─────────────────────────────────────────────────
  console.log("\n☁️  Test Cloudflare R2...");
  try {
    const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

    const r2 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });

    const testKey = `test/ping-${Date.now()}.txt`;
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: testKey,
        Body: Buffer.from("ping"),
        ContentType: "text/plain",
      })
    );
    await r2.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: testKey,
      })
    );
    console.log("  ✅ R2 Upload + Delete OK");
  } catch (err) {
    console.log(`  ❌ R2 échoué : ${err.message}`);
  }

  // ─── 4. Test Replicate ──────────────────────────────────────────
  console.log("\n🤖 Test Replicate API...");
  try {
    const res = await fetch("https://api.replicate.com/v1/models/nightmareai/real-esrgan", {
      headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` },
    });
    if (res.ok) {
      console.log("  ✅ Replicate API accessible");
    } else {
      console.log(`  ❌ Replicate API — status ${res.status}`);
    }
  } catch (err) {
    console.log(`  ❌ Replicate API inaccessible : ${err.message}`);
  }

  // ─── 5. Test OpenAI ─────────────────────────────────────────────
  console.log("\n🧠 Test OpenAI API...");
  try {
    const res = await fetch("https://api.openai.com/v1/models/gpt-4o-mini", {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (res.ok) {
      console.log("  ✅ OpenAI API — gpt-4o-mini accessible");
    } else {
      const body = await res.json().catch(() => ({}));
      console.log(`  ❌ OpenAI API — status ${res.status} : ${body?.error?.message ?? ""}`);
    }
  } catch (err) {
    console.log(`  ❌ OpenAI API inaccessible : ${err.message}`);
  }

  // ─── 6. Simulation Sharp des 4 presets ──────────────────────────
  console.log("\n🎨 Simulation des 4 presets (partie Sharp locale, sans Replicate)...");
  const sharp = require("sharp");
  const outputDir = join(__dirname, "../test-output");

  const presets = [
    {
      name: "Instagram (1080×1080)",
      fn: async (buf) =>
        sharp(buf)
          .rotate()
          .resize(1080, 1080, { fit: "cover", position: "attention" })
          .modulate({ brightness: 1.05, saturation: 1.3 })
          .sharpen({ sigma: 1.2 })
          .jpeg({ quality: 90, progressive: true })
          .toBuffer(),
      file: "test-instagram.jpg",
    },
    {
      name: "Airbnb step1 (960×640 avant Replicate)",
      fn: async (buf) =>
        sharp(buf)
          .rotate()
          .resize(960, 640, { fit: "cover", position: "centre", withoutEnlargement: false })
          .modulate({ brightness: 1.1, saturation: 1.2 })
          .linear(1.15, -(0.15 * 128))
          .gamma(1.1)
          .jpeg({ quality: 92, progressive: true })
          .toBuffer(),
      file: "test-airbnb-step1.jpg",
    },
    {
      name: "Vinted step0 (700×700 avant Replicate)",
      fn: async (buf) =>
        sharp(buf)
          .rotate()
          .resize(700, 700, { fit: "inside", withoutEnlargement: false })
          .jpeg({ quality: 95 })
          .toBuffer(),
      file: "test-vinted-step0.jpg",
    },
    {
      name: "Shopify step1 (1400×1400 avant Replicate)",
      fn: async (buf) =>
        sharp(buf)
          .rotate()
          .resize(1400, 1400, { fit: "inside", withoutEnlargement: false })
          .jpeg({ quality: 95 })
          .toBuffer(),
      file: "test-shopify-step1.jpg",
    },
  ];

  for (const preset of presets) {
    try {
      const start = Date.now();
      const result = await preset.fn(imageBuffer);
      const meta = await sharp(result).metadata();
      const elapsed = Date.now() - start;
      writeFileSync(join(outputDir, preset.file), result);
      console.log(
        `  ✅ ${preset.name} — ${meta.width}×${meta.height} px, ${(result.length / 1024).toFixed(0)} KB, ${elapsed}ms → ${preset.file}`
      );
    } catch (err) {
      console.log(`  ❌ ${preset.name} — ${err.message}`);
    }
  }

  // ─── 7. Résumé ──────────────────────────────────────────────────
  console.log("\n=== RÉSUMÉ ===");
  console.log("📁 Fichiers générés dans : app-retouche-photo/test-output/");
  console.log("");
  console.log("Presets avec Replicate (nécessitent un vrai appel API) :");
  console.log("  • Airbnb  : real-esrgan scale=2 sur 960×640 → 1920×1280");
  console.log("  • Vinted  : real-esrgan scale=2 sur 700×700 + remove-bg → 1000×1000 fond blanc");
  console.log("  • Shopify : remove-bg sur 1400×1400 → 2048×2048 fond blanc");
  console.log("  • Instagram : Sharp seul (pas de Replicate) → 1080×1080");
  console.log("");
  console.log("✅ Test terminé. Lance le serveur et teste via l'UI pour vérifier Replicate.\n");
}

main().catch((err) => {
  console.error("\n💥 Erreur fatale :", err);
  process.exit(1);
});
