// Diagnostic : le modèle de retouche d'image répond-il encore ?
// Lance : npx tsx scripts/test-image-model.ts
// Charge GOOGLE_AI_KEY depuis .env(.local) sans jamais l'afficher.
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { readFileSync, existsSync } from "fs";

function loadKey(): string {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    const line = readFileSync(f, "utf8")
      .split(/\r?\n/)
      .find((l) => l.trim().startsWith("GOOGLE_AI_KEY="));
    if (line) return line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("GOOGLE_AI_KEY introuvable dans .env(.local)");
}

const MODELS = ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image", "gemini-2.0-flash-preview-image-generation"];

async function main() {
  const genAI = new GoogleGenAI({ apiKey: loadKey() });
  const img = await sharp({ create: { width: 512, height: 512, channels: 3, background: { r: 120, g: 130, b: 140 } } })
    .jpeg()
    .toBuffer();
  const b64 = img.toString("base64");

  for (const model of MODELS) {
    process.stdout.write(`\n[${model}] ... `);
    try {
      const resp = await genAI.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: "image/jpeg", data: b64 } }, { text: "Improve brightness and contrast slightly." }] }],
        config: { abortSignal: AbortSignal.timeout(60000) },
      });
      const parts = (resp as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }> })
        .candidates?.[0]?.content?.parts ?? [];
      const hasImage = parts.some((p) => p.inlineData?.data);
      console.log(hasImage ? "✅ OK — image renvoyée" : "⚠️ répond mais AUCUNE image renvoyée");
    } catch (e) {
      console.log(`❌ ERREUR : ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`);
    }
  }
}

main().catch((e) => { console.error("ÉCHEC GLOBAL:", e); process.exit(1); });
