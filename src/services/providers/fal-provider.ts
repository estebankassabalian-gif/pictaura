import { recordImageCall, classifyImageError } from "@/services/monitoring/image-metrics";
import type { ImageEditArgs, ImageEditProvider } from "./types";

/**
 * Prompt Kontext : l'instruction SEULE + garde-fous anti-invention.
 * SURTOUT PAS le "contexte d'expertise" extrait du systemPrompt Gemini
 * ("sky replacement, facade cleaning, lawn enhancement…") : Kontext est
 * littéral — sur une photo sans bâtiment, ce contexte l'a poussé à INVENTER
 * une façade (constaté en prod : maison générée dans une forêt).
 */
function buildKontextPrompt(instruction: string): string {
  return `${instruction.trim()} — Strictly photorealistic. Do NOT add, remove, move or invent any object, building, structure, person or scenery that is not in the original photo. No text, no watermark. Preserve the original scene, framing and composition exactly.`;
}

/**
 * Provider fal.ai — FLUX.1 Kontext [pro] (édition par instruction, préserve le
 * sujet — critique pour l'immobilier : on ne livre jamais "une autre maison").
 *
 * Endpoint synchrone `fal.run` : POST → JSON avec l'URL de l'image générée.
 * Entrée image en data-URI base64 (pas d'upload préalable nécessaire).
 * Coût ~0,04 $/image, latence attendue de l'ordre de quelques secondes —
 * mesurée précisément par le script scripts/test-fal-kontext.ts (tâche E).
 *
 * IMPORTANT licence : [pro]/[max] via API = usage commercial OK. Ne jamais
 * basculer sur [dev] auto-hébergé (licence non commerciale).
 */
const FAL_MODEL = "fal-ai/flux-pro/kontext";
const FAL_LABEL = `fal:${FAL_MODEL}`;
const REAL_TIMEOUT_MS = 90_000; // généreux : Kontext répond normalement en < 15 s
const RETRY_BACKOFF_MS = [2_000, 6_000];

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export class FalProvider implements ImageEditProvider {
  readonly name = "fal";

  isConfigured(): boolean {
    return Boolean(process.env.FAL_KEY);
  }

  async editImage(args: ImageEditArgs): Promise<Buffer> {
    const kind = args.kind ?? "real";
    const maxAttempts = kind === "canary" ? 1 : 3;
    const timeoutMs = args.timeoutMs ?? REAL_TIMEOUT_MS;
    const prompt = buildKontextPrompt(args.instruction.slice(0, 1200));

    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt - 1] ?? 6_000));
      }
      const t0 = Date.now();
      try {
        const buffer = await this.callOnce(args.imageBase64, prompt, timeoutMs);
        recordImageCall({ kind, success: true, latencyMs: Date.now() - t0, model: FAL_LABEL });
        return buffer;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        recordImageCall({
          kind,
          success: false,
          latencyMs: Date.now() - t0,
          model: FAL_LABEL,
          errorCode: classifyImageError(lastErr),
        });
        // 4xx non-429 (clé invalide, payload rejeté, solde épuisé=403) : inutile de retenter
        const m = lastErr.message.match(/^fal HTTP (\d{3})/);
        if (m && !isRetryable(Number(m[1]))) throw lastErr;
      }
    }
    throw lastErr ?? new Error("fal: échec sans détail");
  }

  private async callOnce(imageBase64: string, prompt: string, timeoutMs: number): Promise<Buffer> {
    const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_url: `data:image/jpeg;base64,${imageBase64}`,
        output_format: "jpeg",
        // Tolérance de sécurité par défaut (2) : photos immo/produit = contenu sain.
        num_images: 1,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // "429" / "quota" dans le message → classifyImageError les reconnaît
      throw new Error(`fal HTTP ${res.status}${res.status === 429 ? " (429 rate limit)" : ""}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { images?: Array<{ url?: string }> };
    const url = json.images?.[0]?.url;
    if (!url) throw new Error("fal: aucune image retournée");

    // L'image peut arriver en data-URI ou en URL hébergée fal
    if (url.startsWith("data:")) {
      const b64 = url.slice(url.indexOf(",") + 1);
      return Buffer.from(b64, "base64");
    }
    const imgRes = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!imgRes.ok) throw new Error(`fal: téléchargement du résultat impossible (HTTP ${imgRes.status})`);
    return Buffer.from(await imgRes.arrayBuffer());
  }
}
