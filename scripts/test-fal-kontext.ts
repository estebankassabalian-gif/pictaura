/**
 * TÂCHE E — Validation FLUX Kontext [pro] (fal.ai) sur de VRAIES photos.
 * C'est le go/no-go de la bascule de provider : qualité (ton œil),
 * vitesse (mesurée) et résolution de sortie (mesurée).
 *
 * Usage :
 *   npx tsx scripts/test-fal-kontext.ts "C:\chemin\vers\photos" [preset] ["instruction custom"]
 *   preset : immobilier (défaut) | social | ecommerce
 *
 * Prérequis : FAL_KEY dans .env (https://fal.ai/dashboard/keys) + crédits.
 * Coût : ~0,04 $/photo. Les résultats sont écrits dans <dossier>\fal-kontext-resultats\.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, extname, basename } from "path";
import sharp from "sharp";

const FAL_MODEL = "fal-ai/flux-pro/kontext";

function loadKey(name: string): string {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    const line = readFileSync(f, "utf8").split(/\r?\n/).find((l) => l.trim().startsWith(`${name}=`));
    if (line) {
      const v = line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
      if (v) return v;
    }
  }
  throw new Error(`${name} introuvable dans .env(.local) — crée ta clé sur https://fal.ai/dashboard/keys`);
}

// Instructions représentatives de ce que le pipeline envoie par preset.
const PRESET_INSTRUCTIONS: Record<string, { context: string; instruction: string }> = {
  immobilier: {
    context: "Professional real estate photo editing: HDR-like balanced exposure, corrected verticals and white balance. ",
    instruction:
      "Enhance this real estate photo: balanced bright exposure, vivid but realistic colors, blue sky, green healthy lawn and clear pool water if present. Keep the property strictly identical — do not add, remove or invent any element.",
  },
  social: {
    context: "Professional social media photo editing: cinematic color grading. ",
    instruction:
      "Enhance this photo with a cinematic orange-and-teal look, crisp details and eye-catching contrast, keeping it photorealistic and faithful to the original scene.",
  },
  ecommerce: {
    context: "Professional e-commerce product photo editing: studio lighting, faithful colors. ",
    instruction:
      "Enhance this product photo: clean studio-like lighting, sharp product details, accurate colors and materials. Keep the product strictly identical.",
  },
};

function buildPrompt(context: string, instruction: string): string {
  // Même charpente que buildEditPrompt du pipeline (contraintes photoréalisme)
  return `${context}Apply this edit to the photo: ${instruction}. IMPORTANT: Keep the result strictly photorealistic. Do NOT generate, invent, or hallucinate any element that is not already in the original photo. Only enhance what exists. Professional quality, no text, no watermarks, preserve the original scene and composition.`;
}

async function main() {
  const [folder, presetArg, customInstruction] = process.argv.slice(2);
  if (!folder) {
    console.log('Usage: npx tsx scripts/test-fal-kontext.ts "C:\\chemin\\photos" [immobilier|social|ecommerce] ["instruction custom"]');
    process.exit(1);
  }
  const preset = PRESET_INSTRUCTIONS[presetArg ?? "immobilier"] ?? PRESET_INSTRUCTIONS.immobilier;
  const falKey = loadKey("FAL_KEY");

  const files = readdirSync(folder).filter((f) =>
    [".jpg", ".jpeg", ".png", ".webp"].includes(extname(f).toLowerCase())
  );
  if (files.length === 0) {
    console.log("Aucune image (.jpg/.jpeg/.png/.webp) dans ce dossier.");
    process.exit(1);
  }

  const outDir = join(folder, "fal-kontext-resultats");
  mkdirSync(outDir, { recursive: true });
  const prompt = buildPrompt(preset.context, customInstruction ?? preset.instruction);

  console.log(`\n${files.length} photo(s) · modèle ${FAL_MODEL} · coût estimé ~$${(files.length * 0.04).toFixed(2)}`);
  console.log(`Sorties → ${outDir}\n`);

  const latencies: number[] = [];
  for (const file of files) {
    process.stdout.write(`${file} ... `);
    try {
      // Même pré-traitement que le pipeline : resize 2048px max
      const input = await sharp(join(folder, file))
        .rotate()
        .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 92 })
        .toBuffer();

      const t0 = Date.now();
      const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
        method: "POST",
        headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          image_url: `data:image/jpeg;base64,${input.toString("base64")}`,
          output_format: "jpeg",
          num_images: 1,
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);

      const json = (await res.json()) as { images?: Array<{ url?: string }> };
      const url = json.images?.[0]?.url;
      if (!url) throw new Error("aucune image retournée");

      let out: Buffer;
      if (url.startsWith("data:")) out = Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
      else out = Buffer.from(await (await fetch(url)).arrayBuffer());

      const latency = (Date.now() - t0) / 1000;
      latencies.push(latency);
      const meta = await sharp(out).metadata();
      const outPath = join(outDir, `${basename(file, extname(file))}-kontext.jpg`);
      writeFileSync(outPath, out);
      console.log(`✅ ${latency.toFixed(1)}s · sortie ${meta.width}x${meta.height}`);
    } catch (e) {
      console.log(`❌ ${e instanceof Error ? e.message.slice(0, 160) : e}`);
    }
  }

  if (latencies.length > 0) {
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    console.log(`\n── Bilan vitesse ──`);
    console.log(`moyenne ${avg.toFixed(1)}s · min ${Math.min(...latencies).toFixed(1)}s · max ${Math.max(...latencies).toFixed(1)}s`);
    console.log(`(rappel : Gemini actuel = 60 à 150s/photo)`);
    console.log(`\nJuge maintenant la QUALITÉ à l'œil dans ${outDir}`);
    console.log(`et note la RÉSOLUTION de sortie : si < 1920px, on chaînera l'upscale ESRGAN dans le pipeline immo.`);
  }
}

main().catch((e) => {
  console.error("ÉCHEC:", e instanceof Error ? e.message : e);
  process.exit(1);
});
