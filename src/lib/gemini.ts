/**
 * Module IA — Analyse & Retouche photo
 *
 * Analyse  : Gemini 2.5 Flash vision            (GOOGLE_AI_KEY)
 * Retouche : Gemini 3.1 Flash Image "Nano Banana 2"  (GOOGLE_AI_KEY)
 *
 * Les deux utilisent la même clé GOOGLE_AI_KEY.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/config/env";
import type { Preset } from "@prisma/client";

let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) _genAI = new GoogleGenerativeAI(env.GOOGLE_AI_KEY ?? "");
  return _genAI;
}

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
  altText: "Photo optimisée par Pictaura",
  seoFileName: "photo-optimisee.jpg",
  description: "Photo optimisée par IA",
  keywords: "",
  metaTitle: "",
  hashtags: "",
  seoSchemaJson: "",
};

/**
 * Retry-able = transient API errors (503 overload, 429 rate limit, 500/504, network).
 * Non-retry-able = content safety blocks, invalid input, auth errors.
 */
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
    msg.includes("econnreset") ||
    msg.includes("enotfound") ||
    msg.includes("fetch failed")
  );
}

/**
 * Backoff progressif adapté aux pics Gemini : 2s, 5s, 10s, 20s, 30s (~67s total).
 * Suffit à encaisser la majorité des spikes 503 "high demand" (typiquement 15-60s).
 */
const BACKOFF_MS = [2000, 5000, 10000, 20000, 30000];

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 5
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = BACKOFF_MS[attempt - 1] ?? 30000;
        console.log(`${label} retry ${attempt}/${maxRetries} in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
      return await fn();
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

/**
 * Prompts SEO enrichis par preset. Chaque preset produit un JSON-LD ciblé
 * pour sa plateforme de destination : RealEstateListing + geo + numberOfRooms
 * pour l'immobilier, Product + brand + offers pour Shopify, ImageObject
 * universel pour Google Images.
 */
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
      return `Tu es un expert SEO immobilier Google.${locHint} Analyse cette photo et retourne STRICTEMENT ce JSON :
{
  "altText": "description image SEO (max 120 chars, FR, mots-clés immo pertinents : type de pièce, caractéristiques visibles, lumière, style)",
  "seoFileName": "nom-fichier-seo.jpg (max 60 chars, minuscules, tirets, ex: salon-lumineux-parquet-chevron-paris-11.jpg)",
  "description": "description courte pour annonce (max 200 chars, accroche commerciale, caractéristiques clés)",
  "keywords": ["mot-cle-1","mot-cle-2","mot-cle-3","mot-cle-4","mot-cle-5","mot-cle-6","mot-cle-7"],
  "metaTitle": "titre SEO page annonce (max 60 chars)",
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
      return `Tu es un expert growth Instagram. Analyse cette photo et retourne STRICTEMENT ce JSON :
{
  "altText": "description image SEO Instagram (max 120 chars, FR, mots-clés visuels)",
  "seoFileName": "nom-fichier-seo.jpg (max 60 chars, minuscules, tirets)",
  "description": "caption Instagram accrocheur (max 200 chars, ton direct, 1 emoji max)",
  "keywords": ["mot-cle-1","mot-cle-2","mot-cle-3","mot-cle-4","mot-cle-5"],
  "metaTitle": "",
  "hashtags": "#tag1 #tag2 #tag3 ... (20 hashtags mix FR+EN, niche et large, séparés par espace)",
  "seoSchemaJson": "",
  ${imageObjectBlock}
}`;
    case "SHOPIFY":
    default:
      return `Tu es un expert e-commerce Shopify / Google Shopping. Analyse cette photo et retourne STRICTEMENT ce JSON :
{
  "altText": "description produit SEO (max 120 chars, FR, nom produit + caractéristiques visuelles)",
  "seoFileName": "nom-produit-seo.jpg (max 60 chars, minuscules, tirets)",
  "description": "description produit e-commerce (max 200 chars, bénéfices, matériaux, usage)",
  "keywords": ["mot-cle-1","mot-cle-2","mot-cle-3","mot-cle-4","mot-cle-5","mot-cle-6"],
  "metaTitle": "titre SEO produit (max 60 chars)",
  "hashtags": "",
  "seoSchemaJson": {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "[nom produit]",
    "description": "[description]",
    "image": "[IMAGE_URL]",
    "brand": { "@type": "Brand", "name": "[marque visible ou inférée]" },
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

  // Combine les deux schémas en un @graph unique si les deux existent,
  // sinon renvoie celui qui existe.
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
 * Génère les métadonnées SEO enrichies via Gemini 2.5 Flash vision.
 *
 * - ~5x moins cher que GPT-4o-mini pour le même résultat structuré
 * - JSON-LD enrichi par preset (RealEstateListing, Product, ImageObject)
 * - Retry automatique 3 tentatives avec backoff exponentiel
 * - Fallback sûr si tous les retries échouent (non-bloquant pour le pipeline)
 */
export async function generatePhotoSEO(
  imageBase64: string,
  preset: Preset,
  userLocation?: string
): Promise<PhotoSeoResult> {
  const prompt = buildSeoPrompt(preset, userLocation);

  try {
    return await withRetry(async () => {
      const model = getGenAI().getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 900,
          temperature: 0.4,
        } as unknown as Record<string, unknown>,
      });

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
              { text: prompt + "\n\nRéponds UNIQUEMENT en JSON valide, sans markdown." },
            ],
          },
        ],
      });

      const text = result.response.text().replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(text);
      return coerceSeoResponse(parsed);
    }, "Gemini SEO");
  } catch (err) {
    console.error("generatePhotoSEO: all retries failed, falling back", err);
    return SEO_FALLBACK;
  }
}

/**
 * Évalue la photo sur 10 selon les critères de la plateforme cible.
 * Utilise Gemini 2.5 Flash vision.
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
      const model = getGenAI().getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 300,
          temperature: 0.3,
        } as unknown as Record<string, unknown>,
      });

      const result = await model.generateContent({
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
      });

      const text = result.response.text().replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(text);
      return {
        score: Math.min(10, Math.max(0, Number(parsed.score) || 0)),
        report: String(parsed.report ?? "Photo traitée avec succès."),
      };
    }, "Gemini score");
  } catch (err) {
    console.error("scorePhoto: all retries failed, falling back", err);
    return { score: 7, report: "Photo traitée avec succès." };
  }
}

/**
 * Analyse une photo avec Gemini 2.5 Flash vision.
 * Retourne une analyse textuelle + 3-5 suggestions de retouche.
 */
export async function analyzePhotoForRetouching(
  imageBase64: string,
  analyzePrompt: string
): Promise<{ analysis: string; suggestions: string[] }> {
  return await withRetry(async () => {
    const model = getGenAI().getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 500,
      } as unknown as Record<string, unknown>,
    });

    const result = await model.generateContent({
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
    });

    const text = result.response.text();
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      analysis: String(parsed.analysis ?? "Photo prête à être retouchée"),
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 5)
        : [],
    };
  }, "Gemini analyze");
}

/**
 * Détecte les tentatives d'injection de prompt.
 */
function hasPromptInjection(instruction: string): boolean {
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
 *
 * @param imageBase64 - Image source en base64 (JPEG)
 * @param instruction - Instructions de retouche utilisateur (max 300 chars)
 * @param systemPrompt - Prompt système de l'agent métier (immobilier, instagram, etc.)
 */
export async function retouchPhoto(
  imageBase64: string,
  instruction: string,
  systemPrompt: string
): Promise<Buffer> {
  const cleanInstruction = instruction.slice(0, 300);

  if (hasPromptInjection(cleanInstruction)) {
    throw new Error("Instruction refusée : contenu non autorisé détecté");
  }

  const editPrompt = buildEditPrompt(systemPrompt, cleanInstruction);

  return await withRetry(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = getGenAI().getGenerativeModel({
      model: "gemini-3.1-flash-image-preview",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      generationConfig: { responseModalities: ["image"] } as any,
    });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
            { text: editPrompt },
          ],
        },
      ],
    });

    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inlineData = (part as any).inlineData;
      if (inlineData?.data) {
        return Buffer.from(inlineData.data, "base64");
      }
    }

    throw new Error("Gemini : aucune image retournée par l'API");
  }, "Gemini retouch");
}

/**
 * Construit le prompt d'édition à partir du contexte métier de l'agent
 * et de l'instruction spécifique de l'utilisateur.
 */
function buildEditPrompt(systemPrompt: string, instruction: string): string {
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
