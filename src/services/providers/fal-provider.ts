import { recordImageCall, classifyImageError } from "@/services/monitoring/image-metrics";
import type { ImageEditArgs, ImageEditProvider, ImageEditResult } from "./types";

/**
 * Provider fal.ai — modèle CONFIGURABLE sans redéploiement (IMAGE_FAL_MODEL).
 *
 * Défaut : **Nano Banana 2** (`fal-ai/nano-banana-2/edit`) = Gemini 3.1 Flash
 * Image — LA qualité validée par Esteban (relight global natif, rendu annonce
 * premium), servie par l'infra fal en ~15 s mesurées (vs 60-150 s via l'API
 * Google directe), SANS dépendance à la facturation Google.
 *
 * RÉSILIENCE : le fallback historique de l'orchestrateur (bascule vers
 * GeminiProvider) est aujourd'hui inopérant — la facturation Google est
 * cassée depuis fin juin. Ce provider porte donc son propre filet interne :
 * si le modèle primaire échoue après tous ses retries, UNE tentative est
 * faite sur IMAGE_FAL_FALLBACK_MODEL (défaut `fal-ai/flux-pro/kontext`,
 * déjà validé qualité sur l'immo) avant d'abandonner. Le modèle réellement
 * utilisé est renvoyé dans ImageEditResult.model — jamais déduit de
 * modelLabel(), qui ne reflète que le primaire configuré.
 *
 * Endpoint synchrone `fal.run` : POST → JSON avec l'URL de l'image générée.
 * Entrée image en data-URI base64 (pas d'upload préalable nécessaire).
 * Licence : modèles via API fal = usage commercial OK (ne jamais auto-héberger
 * un poids [dev] non-commercial).
 */
function falModel(): string {
  return process.env.IMAGE_FAL_MODEL?.trim() || "fal-ai/nano-banana-2/edit";
}

function falFallbackModel(): string | null {
  const v = process.env.IMAGE_FAL_FALLBACK_MODEL?.trim();
  if (v === "") return null; // désactivation explicite du filet interne
  const model = v || "fal-ai/flux-pro/kontext";
  return model !== falModel() ? model : null; // pas de filet si identique au primaire
}

const REAL_TIMEOUT_MS = 120_000;
const RETRY_BACKOFF_MS = [2_000, 6_000];

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Prompt fal : l'instruction SEULE + garde-fous anti-invention.
 * SURTOUT PAS le "contexte d'expertise" extrait du systemPrompt Gemini
 * ("sky replacement, facade cleaning, lawn enhancement…") : un éditeur
 * littéral peut INVENTER une façade sur une photo sans bâtiment (constaté
 * en prod avec Kontext : maison générée dans une forêt).
 */
function buildFalPrompt(instruction: string): string {
  return `${instruction.trim()} — Strictly photorealistic. Do NOT add, remove, move or invent any object, building, structure, person or scenery that is not in the original photo. No text, no watermark. Preserve the original scene, framing and composition exactly.`;
}

/** Adaptateur de schéma d'entrée : nano-banana attend image_urls (pluriel). */
function buildRequestBody(model: string, prompt: string, dataUri: string): Record<string, unknown> {
  if (model.includes("nano-banana")) {
    return { prompt, image_urls: [dataUri], num_images: 1, output_format: "jpeg" };
  }
  return { prompt, image_url: dataUri, num_images: 1, output_format: "jpeg" };
}

export class FalProvider implements ImageEditProvider {
  readonly name = "fal";

  isConfigured(): boolean {
    return Boolean(process.env.FAL_KEY);
  }

  modelLabel(): string {
    return `fal:${falModel()}`;
  }

  async editImage(args: ImageEditArgs): Promise<ImageEditResult> {
    const kind = args.kind ?? "real";
    const prompt = buildFalPrompt(args.instruction.slice(0, 1200));

    const primaryModel = falModel();
    const primaryErr = await this.tryModel(primaryModel, args, prompt, kind);
    if (!("error" in primaryErr)) return primaryErr;

    // Le canary doit refléter l'état brut du primaire — jamais masqué par un filet.
    if (kind === "canary") throw primaryErr.error;

    const fallbackModel = falFallbackModel();
    if (!fallbackModel) throw primaryErr.error;

    console.warn(
      `fal: "${primaryModel}" a épuisé ses tentatives, essai du filet interne "${fallbackModel}"`
    );
    const fallbackRes = await this.tryModel(fallbackModel, args, prompt, kind);
    if (!("error" in fallbackRes)) return fallbackRes;

    // Les deux ont échoué : on remonte l'erreur du PRIMAIRE (plus pertinente
    // pour le breaker/les alertes — c'est lui la config attendue).
    throw primaryErr.error;
  }

  /** Tente un modèle avec ses retries propres. Ne throw jamais : renvoie {error}. */
  private async tryModel(
    model: string,
    args: ImageEditArgs,
    prompt: string,
    kind: "real" | "canary"
  ): Promise<ImageEditResult | { error: Error }> {
    const maxAttempts = kind === "canary" ? 1 : 3;
    const timeoutMs = args.timeoutMs ?? REAL_TIMEOUT_MS;
    const label = `fal:${model}`;

    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS[attempt - 1] ?? 6_000));
      }
      const t0 = Date.now();
      try {
        const buffer = await this.callOnce(model, args.imageBase64, prompt, timeoutMs);
        recordImageCall({ kind, success: true, latencyMs: Date.now() - t0, model: label });
        return { buffer, model: label };
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        recordImageCall({
          kind,
          success: false,
          latencyMs: Date.now() - t0,
          model: label,
          errorCode: classifyImageError(lastErr),
        });
        // 4xx non-429 (clé invalide, payload rejeté, solde épuisé=403) : inutile de retenter
        const m = lastErr.message.match(/^fal HTTP (\d{3})/);
        if (m && !isRetryable(Number(m[1]))) break;
      }
    }
    return { error: lastErr ?? new Error(`fal (${model}): échec sans détail`) };
  }

  private async callOnce(model: string, imageBase64: string, prompt: string, timeoutMs: number): Promise<Buffer> {
    const dataUri = `data:image/jpeg;base64,${imageBase64}`;
    const res = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildRequestBody(model, prompt, dataUri)),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // "429" / "quota" dans le message → classifyImageError les reconnaît
      throw new Error(`fal HTTP ${res.status}${res.status === 429 ? " (429 rate limit)" : ""}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { images?: Array<{ url?: string }>; image?: { url?: string } };
    const url = json.images?.[0]?.url ?? json.image?.url;
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
