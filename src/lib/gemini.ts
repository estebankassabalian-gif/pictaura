/**
 * Module IA — Analyse & Retouche photo
 *
 * SDK : @google/genai (unifié, remplace @google/generative-ai EOL nov-2025)
 * Analyse  : gemini-2.5-flash           (GOOGLE_AI_KEY)
 * Retouche : gemini-3.1-flash-image-preview "Nano Banana 2"  (GOOGLE_AI_KEY)
 */

import { GoogleGenAI } from "@google/genai";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/config/env";
import type { Preset } from "@prisma/client";
import { recordImageCall, classifyImageError } from "@/services/monitoring/image-metrics";

// Modèle image (retouche) — centralisé pour l'instrumentation et le canary.
const RETOUCH_MODEL = "gemini-3.1-flash-image-preview";

let _genAI: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!_genAI) _genAI = new GoogleGenAI({ apiKey: env.GOOGLE_AI_KEY ?? "" });
  return _genAI;
}

// Hard timeouts to prevent hung requests blocking the pipeline forever.
// Retouch: Gemini 3.1 Flash Image (Nano Banana 2) usually completes in 60-150s.
// Escalating per-attempt timeouts: most successful generations finish well under
// 90s, so a hung first request gets cut early and retried instead of blocking
// its pool slot for 180s. Later attempts get more headroom for genuinely slow
// (but successful) runs.
const RETOUCH_ATTEMPT_TIMEOUTS_MS = [90_000, 150_000, 180_000];
// Global wall-clock budget per photo (attempts + backoffs). Caps the worst case
// at ~5 min instead of the previous theoretical ~15 min (5 × 180s + backoffs).
const RETOUCH_DEADLINE_MS = 300_000;
const TEXT_TIMEOUT_MS = 45_000;    // SEO / score / analyze

export interface PhotoSeoResult {
  altText: string;
  seoFileName: string;
  description: string;
  keywords: string;
  metaTitle: string;
  hashtags: string;
  seoSchemaJson: string;
}

const SEO_FALLBACK: PhotoSeoResult = {
  altText: "",
  seoFileName: "",
  description: "",
  keywords: "",
  metaTitle: "",
  hashtags: "",
  seoSchemaJson: "",
};

function isRetryableError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  if (msg.includes("safety") || msg.includes("blocked") || msg.includes("refusée")) return false;
  if (msg.includes("invalid") || msg.includes("unauthorized") || msg.includes("forbidden")) return false;
  return (
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("504") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("timeout") ||
    msg.includes("aborted") ||
    msg.includes("econnreset") ||
    msg.includes("enotfound") ||
    msg.includes("fetch failed")
  );
}

const BACKOFF_MS = [2000, 5000, 10000, 20000, 30000];

async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  label: string,
  maxRetries = 3,
  deadlineMs?: number
): Promise<T> {
  const startedAt = Date.now();
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = BACKOFF_MS[attempt - 1] ?? 30000;
        if (deadlineMs && Date.now() - startedAt + delay > deadlineMs) {
          console.error(`${label}: deadline ${deadlineMs}ms exceeded, giving up after ${attempt} attempt(s)`);
          break;
        }
        console.log(`${label} retry ${attempt}/${maxRetries} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
      return await fn(attempt);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`${label} attempt ${attempt + 1} failed:`, lastError.message);
      if (!isRetryableError(lastError)) {
        throw lastError;
      }
    }
  }
  throw lastError ?? new Error(`${label}: all retries failed`);
}

function buildSeoPrompt(preset: Preset, userLocation?: string): string {
  const loc = userLocation?.trim();
  const locHint = loc ? ` Contexte géographique : ${loc}.` : "";
  const locGeoBlock = loc
    ? `,\n      "address": {\n        "@type": "PostalAddress",\n        "addressLocality": "${loc.replace(/"/g, "")}",\n        "addressCountry": "FR"\n      }`
    : "";

  const imageObjectBlock = `"imageObject": {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    "contentUrl": "[IMAGE_URL]",
    "name": "[titre]",
    "description": "[description]",
    "creditText": "Pictaura",
    "creator": { "@type": "Organization", "name": "Pictaura" },
    "copyrightNotice": "pictaura.app",
    "license": "https://pictaura.app/licence"
  }`;

  switch (preset) {
    case "AIRBNB":
    case "IMMOBILIER":
      return `Tu es un expert SEO immobilier Google + portails (SeLoger, Leboncoin, Idealista, Airbnb, Booking).${locHint}

ÉTAPE 1 — Détecte (silencieusement) :
- Type de pièce : salon, cuisine, chambre, salle de bain, entrée, bureau, terrasse, jardin, piscine, façade extérieure, vue, local, garage, cave, dressing.
- Caractéristiques visibles : parquet / carrelage / pierre / béton ciré, poutres apparentes, cheminée, baie vitrée, balcon, hauteur sous plafond, moulures, îlot central, dressing, vasque double, douche italienne, verrière, etc.
- Style : haussmannien, moderne, contemporain, loft, campagne, bord de mer, scandinave, industriel, provençal.
- Qualité lumière : plein jour, golden hour, twilight, nuit.

ÉTAPE 2 — Retourne STRICTEMENT ce JSON (tout en FR, sans inventer) :
{
  "altText": "description image SEO (max 120 chars, FR, type de pièce + 2 caractéristiques + style + lumière, ex: 'Salon lumineux haussmannien, parquet chevron et cheminée, Paris 11')",
  "seoFileName": "nom-fichier-seo.jpg (max 60 chars, minuscules, tirets, inclure type de pièce + caractéristique clé + ville si connue)",
  "description": "accroche commerciale pour annonce (max 200 chars, bénéfice émotionnel + caractéristiques fortes)",
  "keywords": ["type-piece","caracteristique-1","caracteristique-2","style","atout-1","atout-2","${loc ? loc.toLowerCase().replace(/\s+/g, "-") : "ville"}"],
  "metaTitle": "titre SEO annonce (max 60 chars, pattern : '[Type pièce] [atout clé] — [ville/quartier]')",
  "hashtags": "",
  "seoSchemaJson": {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "name": "[titre annonce]",
    "description": "[description]",
    "image": "[IMAGE_URL]",
    "numberOfRooms": "[nb de pièces visibles ou estimé, ex: 3]",
    "floorSize": { "@type": "QuantitativeValue", "unitCode": "MTK", "value": "[surface estimée en m² si visible]" }${locGeoBlock}
  },
  ${imageObjectBlock}
}`;
    case "INSTAGRAM":
      return `Tu es un expert growth Instagram / TikTok / Pinterest.

ÉTAPE 1 — Détecte (silencieusement) :
- Sujet : portrait, lifestyle, food, produit, paysage, animal, mode, beauté, fitness, voyage, deco, art.
- Mood : cozy, minimaliste, vintage, moody, bold, soft, playful, luxe, streetwear, nature, urbain.
- Style visuel : film, éditorial, golden hour, flat lay, mirror selfie, studio.
- Saison / contexte visuel quand détectable.

ÉTAPE 2 — Retourne STRICTEMENT ce JSON :
{
  "altText": "description image SEO Instagram (max 120 chars, FR, sujet + mood + 1 détail visuel fort)",
  "seoFileName": "nom-fichier-seo.jpg (max 60 chars, minuscules, tirets, sujet-mood-contexte)",
  "description": "caption Instagram accrocheur (max 200 chars, hook direct, 1 emoji max, invite à enregistrer/commenter)",
  "keywords": ["sujet","mood","style","contexte","detail-visuel"],
  "metaTitle": "",
  "hashtags": "#tag1 #tag2 ... (22 hashtags séparés par espace, stratégie : 6 viraux/larges FR+EN + 10 niche ciblés + 6 émergents/petits — couvrir sujet, mood, style, saison)",
  "seoSchemaJson": "",
  ${imageObjectBlock}
}`;
    case "SHOPIFY":
    default:
      return `Tu es un expert e-commerce Shopify / Google Shopping / Amazon / Vinted / Etsy.

ÉTAPE 1 — Détecte (silencieusement) :
- Catégorie produit : vêtement, chaussures, bijou, accessoire, déco, maison, beauté, tech, bébé, sport, art, etc.
- Pour les vêtements : type (robe, chemise, pull...), coupe, motif, matière visible (coton, laine, lin, cuir, soie, denim).
- Couleur dominante + 1 couleur secondaire (termes commerciaux : beige, vert sauge, bleu marine, terracotta, écru...).
- Matière / texture : lisse, mat, brillant, tissé, tricoté, métal, bois, céramique.
- Marque visible (logo, étiquette) ou "générique" sinon.
- Condition si perceptible : neuf, très bon état, bon état, occasion.

ÉTAPE 2 — Retourne STRICTEMENT ce JSON (FR, honnête, sans inventer) :
{
  "altText": "description produit SEO (max 120 chars, FR, pattern : '[Catégorie] [couleur] [matière] [marque] [détail]')",
  "seoFileName": "nom-produit-seo.jpg (max 60 chars, minuscules, tirets, catégorie-couleur-matière-marque si visible)",
  "description": "description produit (max 200 chars, bénéfice + matière + usage + mot-clé long-tail)",
  "keywords": ["categorie","couleur-principale","matiere","marque-ou-style","usage","tendance"],
  "metaTitle": "titre SEO produit (max 60 chars, pattern : '[Produit] [couleur] [marque] — [caractéristique]')",
  "hashtags": "",
  "seoSchemaJson": {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "[nom produit]",
    "description": "[description]",
    "image": "[IMAGE_URL]",
    "color": "[couleur dominante]",
    "material": "[matière détectée ou 'non spécifié']",
    "brand": { "@type": "Brand", "name": "[marque visible ou 'Sans marque']" },
    "sku": "[sku-auto-genere-a-partir-du-nom]",
    "offers": {
      "@type": "Offer",
      "priceCurrency": "EUR",
      "availability": "https://schema.org/InStock",
      "itemCondition": "https://schema.org/NewCondition"
    }
  },
  ${imageObjectBlock}
}`;
  }
}

function coerceSeoResponse(raw: unknown): PhotoSeoResult {
  const parsed = (raw ?? {}) as Record<string, unknown>;

  const keywords = Array.isArray(parsed.keywords)
    ? JSON.stringify(parsed.keywords)
    : typeof parsed.keywords === "string"
    ? parsed.keywords
    : "";

  const serialiseMaybeJson = (v: unknown): string => {
    if (v == null || v === "") return "";
    if (typeof v === "string") return v;
    try {
      return JSON.stringify(v);
    } catch {
      return "";
    }
  };

  const schemaMain = serialiseMaybeJson(parsed.seoSchemaJson);
  const imageObject = serialiseMaybeJson((parsed as Record<string, unknown>).imageObject);

  let combined = "";
  if (schemaMain && imageObject) {
    try {
      const main = JSON.parse(schemaMain);
      const img = JSON.parse(imageObject);
      combined = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [main, img],
      });
    } catch {
      combined = schemaMain;
    }
  } else {
    combined = schemaMain || imageObject;
  }

  return {
    altText: String(parsed.altText ?? SEO_FALLBACK.altText).slice(0, 300),
    seoFileName: String(parsed.seoFileName ?? SEO_FALLBACK.seoFileName).slice(0, 120),
    description: String(parsed.description ?? SEO_FALLBACK.description).slice(0, 500),
    keywords,
    metaTitle: String(parsed.metaTitle ?? "").slice(0, 120),
    hashtags: String(parsed.hashtags ?? "").slice(0, 600),
    seoSchemaJson: combined,
  };
}

/**
 * Resilient JSON parser. Tries standard parse first; on truncation/syntax error,
 * attempts to recover the largest valid prefix by progressively trimming and
 * auto-closing braces/brackets. Returns {} as a last resort so the caller can
 * still produce a partial PhotoSeoResult instead of falling back to empty.
 */
function safeJsonParse(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    // Try greedy recovery: trim to last balanced point
    for (let i = text.length; i > 16; i--) {
      const slice = text.slice(0, i);
      // Auto-close: count unmatched opening { [
      let depthCurly = 0, depthSquare = 0, inStr = false, esc = false;
      for (const ch of slice) {
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === "{") depthCurly++;
        else if (ch === "}") depthCurly--;
        else if (ch === "[") depthSquare++;
        else if (ch === "]") depthSquare--;
      }
      if (inStr) continue; // mid-string, keep trimming
      const closed = slice + "]".repeat(Math.max(0, depthSquare)) + "}".repeat(Math.max(0, depthCurly));
      try {
        const parsed = JSON.parse(closed);
        if (parsed && typeof parsed === "object") {
          console.warn(`safeJsonParse: recovered partial JSON (${i}/${text.length} chars used)`);
          return parsed as Record<string, unknown>;
        }
      } catch {
        // keep trimming
      }
    }
    return {};
  }
}

function extractText(response: unknown): string {
  const r = response as { text?: string | (() => string); response?: { text?: () => string } };
  if (typeof r.text === "string") return r.text;
  if (typeof r.text === "function") return r.text();
  if (r.response?.text) return r.response.text();
  return "";
}

function extractInlineImage(response: unknown): Buffer | null {
  const r = response as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string } }> };
    }>;
  };
  const parts = r.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, "base64");
    }
  }
  return null;
}

/**
 * Génère les métadonnées SEO enrichies (JSON-LD complet) via Gemini 2.5 Flash.
 */
export async function generatePhotoSEO(
  imageBase64: string,
  preset: Preset,
  userLocation?: string
): Promise<PhotoSeoResult> {
  const prompt = buildSeoPrompt(preset, userLocation);

  try {
    return await withRetry(async () => {
      const response = await getGenAI().models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
              { text: prompt + "\n\nRéponds UNIQUEMENT en JSON valide, sans markdown." },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 2800,
          temperature: 0.4,
          abortSignal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
        },
      });

      const text = extractText(response).replace(/```json\n?|\n?```/g, "").trim();
      const parsed = safeJsonParse(text);
      return coerceSeoResponse(parsed);
    }, "Gemini SEO");
  } catch (err) {
    console.error("generatePhotoSEO: all retries failed, falling back", err);
    Sentry.captureException(err, {
      tags: { module: "gemini", stage: "seo_fallback", preset },
      level: "error",
    });
    return SEO_FALLBACK;
  }
}

/**
 * Évalue la photo sur 10 via Gemini 2.5 Flash. Court prompt, court output.
 */
export async function scorePhoto(
  imageBase64: string,
  preset: Preset
): Promise<{ score: number; report: string }> {
  const criteriaMap: Record<string, string> = {
    AIRBNB: "luminosité, cadrage (règle des tiers), rangement, attractivité de la pièce, qualité professionnelle",
    IMMOBILIER: "luminosité, verticalité, cadrage, rangement, attractivité du bien, qualité pro",
    INSTAGRAM: "composition, couleurs, impact visuel, originalité, netteté",
    SHOPIFY: "fond blanc/neutre, netteté produit, éclairage pro, cadrage centré, qualité e-commerce, lisibilité des détails",
  };
  const criteria = criteriaMap[preset] ?? criteriaMap.SHOPIFY;

  try {
    return await withRetry(async () => {
      const response = await getGenAI().models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
              {
                text: `Tu es un expert photographe pro. Évalue cette photo pour ${preset} selon : ${criteria}.
Réponds UNIQUEMENT en JSON : {"score": <0-10 avec 1 décimale>, "report": "<2-3 phrases FR : points forts, faibles, gain IA>"}`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          // Schema constraint → Gemini cannot return malformed JSON, eliminating
          // the truncation/parse-error class of failures entirely for this call.
          responseSchema: {
            type: "object",
            properties: {
              score: { type: "number" },
              report: { type: "string" },
            },
            required: ["score", "report"],
          },
          maxOutputTokens: 500,
          temperature: 0.3,
          abortSignal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
        },
      });

      const text = extractText(response).replace(/```json\n?|\n?```/g, "").trim();
      const parsed = safeJsonParse(text);
      return {
        score: Math.min(10, Math.max(0, Number(parsed.score) || 0)),
        report: String(parsed.report ?? "Photo traitée avec succès."),
      };
    }, "Gemini score");
  } catch (err) {
    console.error("scorePhoto: all retries failed, falling back", err);
    Sentry.captureException(err, {
      tags: { module: "gemini", stage: "score_fallback", preset },
      level: "warning",
    });
    return { score: 0, report: "" };
  }
}

/**
 * Génère SEO + Score en parallèle (2 calls Gemini concurrents).
 * Plus fiable que de combiner en 1 call : le JSON-LD complet + score dépassait souvent
 * maxOutputTokens=1700 et donnait du JSON tronqué non-parsable → fallback vide → "SEO en cours" infini.
 */
export async function generateSeoAndScore(
  imageBase64: string,
  preset: Preset,
  userLocation?: string
): Promise<{ seo: PhotoSeoResult; score: number; report: string }> {
  const [seo, scoreResult] = await Promise.all([
    generatePhotoSEO(imageBase64, preset, userLocation),
    scorePhoto(imageBase64, preset),
  ]);
  return { seo, score: scoreResult.score, report: scoreResult.report };
}

export async function analyzePhotoForRetouching(
  imageBase64: string,
  analyzePrompt: string
): Promise<{ analysis: string; suggestions: string[] }> {
  return await withRetry(async () => {
    const response = await getGenAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
            {
              text: `${analyzePrompt}

IMPORTANT: Réponds UNIQUEMENT avec du JSON valide, sans markdown :
{"analysis":"une phrase en français décrivant la photo","suggestions":["suggestion 1 en français","suggestion 2 en français","suggestion 3 en français"]}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 500,
        abortSignal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
      },
    });

    const text = extractText(response).replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(text);
    return {
      analysis: String(parsed.analysis ?? "Photo prête à être retouchée"),
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 5)
        : [],
    };
  }, "Gemini analyze");
}

// Exporté : la couche provider applique la même garde quel que soit le modèle.
export function hasPromptInjection(instruction: string): boolean {
  const lower = instruction.toLowerCase();
  const patterns = [
    "ignore previous", "ignore above", "ignore all",
    "disregard", "forget your", "system prompt",
    "you are now", "new instructions", "override",
    "act as", "pretend to", "role play",
    "```", "<script", "javascript:",
    "drop table", "delete from", "insert into",
  ];
  return patterns.some((p) => lower.includes(p));
}

/**
 * Retouche une image via Gemini 3.1 Flash Image ("Nano Banana 2").
 */
export async function retouchPhoto(
  imageBase64: string,
  instruction: string,
  systemPrompt: string
): Promise<Buffer> {
  const cleanInstruction = instruction.slice(0, 1200);

  if (hasPromptInjection(cleanInstruction)) {
    throw new Error("Instruction refusée : contenu non autorisé détecté");
  }

  const editPrompt = buildEditPrompt(systemPrompt, cleanInstruction);

  return await withRetry(async (attempt) => {
    const timeoutMs =
      RETOUCH_ATTEMPT_TIMEOUTS_MS[attempt] ??
      RETOUCH_ATTEMPT_TIMEOUTS_MS[RETOUCH_ATTEMPT_TIMEOUTS_MS.length - 1];
    // Instrumentation monitoring : chaque tentative réelle est mesurée et
    // enregistrée (fire-and-forget) — comportement métier inchangé.
    const t0 = Date.now();
    try {
      const response = await getGenAI().models.generateContent({
        model: RETOUCH_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
              { text: editPrompt },
            ],
          },
        ],
        config: {
          abortSignal: AbortSignal.timeout(timeoutMs),
        },
      });

      const img = extractInlineImage(response);
      if (img) {
        recordImageCall({ kind: "real", success: true, latencyMs: Date.now() - t0, model: RETOUCH_MODEL });
        return img;
      }
      throw new Error("Gemini : aucune image retournée par l'API");
    } catch (err) {
      recordImageCall({
        kind: "real",
        success: false,
        latencyMs: Date.now() - t0,
        model: RETOUCH_MODEL,
        errorCode: classifyImageError(err),
      });
      throw err;
    }
  }, "Gemini retouch", 4, RETOUCH_DEADLINE_MS); // user-facing → retries, but hard 5 min wall-clock cap
}

// Exporté : les providers alternatifs (fal…) construisent le MÊME prompt
// d'édition — la cohérence du rendu ne doit pas dépendre du provider.
export function buildEditPrompt(systemPrompt: string, instruction: string): string {
  const expertiseLines = systemPrompt
    .split("\n")
    .filter((l) => l.trim().startsWith("-"))
    .slice(0, 2)
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .join(". ");

  const context = expertiseLines
    ? `Professional photo editing context: ${expertiseLines}. `
    : "";

  return `${context}Apply this edit to the photo: ${instruction}. IMPORTANT: Keep the result strictly photorealistic. Do NOT generate, invent, or hallucinate any element that is not already in the original photo (no fake views through windows, no fake scenery, no fake objects). Only enhance what exists. Professional quality, no text, no watermarks, preserve the original scene and composition.`;
}

/**
 * Canary du modèle IMAGE : un seul appel minimal, SANS retries (le canary doit
 * refléter l'état brut du modèle, pas le masquer derrière des backoffs).
 * Passe par l'instrumentation monitoring (kind: 'canary').
 * Retourne la latence en ms ; throw si le modèle ne répond pas d'image.
 */
export async function canaryImageCall(imageBase64: string, timeoutMs: number): Promise<number> {
  const t0 = Date.now();
  try {
    const response = await getGenAI().models.generateContent({
      model: RETOUCH_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
            { text: "Slightly increase brightness. Keep everything else identical. Photorealistic." },
          ],
        },
      ],
      config: { abortSignal: AbortSignal.timeout(timeoutMs) },
    });
    const img = extractInlineImage(response);
    const latencyMs = Date.now() - t0;
    if (!img) throw new Error("canary: aucune image retournée");
    recordImageCall({ kind: "canary", success: true, latencyMs, model: RETOUCH_MODEL });
    return latencyMs;
  } catch (err) {
    recordImageCall({
      kind: "canary",
      success: false,
      latencyMs: Date.now() - t0,
      model: RETOUCH_MODEL,
      errorCode: classifyImageError(err),
    });
    throw err;
  }
}

/**
 * Lightweight Gemini reachability check for /api/health.
 * 1-token text generation — confirms API key, network, and Gemini availability.
 * Throws on any failure (caller decides how to surface it).
 */
export async function pingGemini(): Promise<{ ok: true; latency_ms: number }> {
  const start = Date.now();
  await getGenAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: "ping" }] }],
    config: {
      maxOutputTokens: 1,
      abortSignal: AbortSignal.timeout(8_000),
    },
  });
  return { ok: true, latency_ms: Date.now() - start };
}
