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

let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) _genAI = new GoogleGenerativeAI(env.GOOGLE_AI_KEY ?? "");
  return _genAI;
}

/**
 * Analyse une photo avec Gemini 2.5 Flash vision.
 * Retourne une analyse textuelle + 3-5 suggestions de retouche.
 */
export async function analyzePhotoForRetouching(
  imageBase64: string,
  analyzePrompt: string
): Promise<{ analysis: string; suggestions: string[] }> {
  const model = getGenAI().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 500,
    } as any,
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
  try {
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      analysis: String(parsed.analysis ?? "Photo prête à être retouchée"),
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 5)
        : [],
    };
  } catch {
    return {
      analysis: "Photo prête à être retouchée",
      suggestions: [],
    };
  }
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

  throw new Error("Nano Banana 2 : aucune image retournée par l'API");
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

  return `${context}Apply this edit to the photo: ${instruction}. Photorealistic, professional quality, no text, no watermarks, preserve the original scene and composition as much as possible.`;
}
