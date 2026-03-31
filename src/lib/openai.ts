import OpenAI from "openai";
import { env } from "@/config/env";
import { Preset } from "@prisma/client";

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

/**
 * Génère les métadonnées SEO enrichies pour une photo traitée.
 * Utilise GPT-4o-mini (~$0.002/appel avec les nouveaux champs).
 *
 * Champs retournés :
 * - altText, seoFileName, description — tous users
 * - keywords, metaTitle — tous users
 * - hashtags (Instagram) — tous users pour l'instant
 * - seoSchemaJson (JSON-LD schema.org) — tous users pour l'instant
 *   (à gater côté pipeline quand la subscription sera implémentée)
 */
export async function generatePhotoSEO(
  imageBase64: string,
  preset: Preset,
  userLocation?: string
): Promise<{
  altText: string;
  seoFileName: string;
  description: string;
  keywords: string;
  metaTitle: string;
  hashtags: string;
  seoSchemaJson: string;
}> {
  const presetContext: Record<string, string> = {
    AIRBNB: "annonce immobilière / location courte durée",
    IMMOBILIER: "annonce immobilière pour agence immobilière",
    INSTAGRAM: "post Instagram / contenu créateur",
    VINTED: "annonce Vinted / vente de vêtements",
    SHOPIFY: "produit boutique e-commerce Shopify",
  };
  const context = presetContext[preset] ?? preset;
  const locationStr = userLocation ? ` à ${userLocation}` : "";

  // Prompt SEO adapté au preset
  const seoPrompts: Record<string, string> = {
    AIRBNB: `
Génère les métadonnées SEO pour cette photo de bien immobilier${locationStr} :
{
  "altText": "description image SEO (max 120 chars, français, mots-clés immo : pièce, superficie, caractéristiques)",
  "seoFileName": "nom-fichier-seo.jpg (max 60 chars, minuscules, tirets, ex: salon-lumineux-appartement-paris.jpg)",
  "description": "description courte pour annonce (max 200 chars, accrocheur, caractéristiques clés)",
  "keywords": "["mot-clé1","mot-clé2","mot-clé3","mot-clé4","mot-clé5"] (JSON array, 5 mots-clés immo pertinents)",
  "metaTitle": "titre SEO page annonce (max 60 chars, ex: Appartement lumineux 68m² - Salon spacieux)",
  "hashtags": "",
  "seoSchemaJson": "{\"@context\":\"https://schema.org\",\"@type\":\"RealEstateListing\",\"name\":\"[titre annonce]\",\"description\":\"[description]\",\"image\":\"[IMAGE_URL]\"}"
}`,
    IMMOBILIER: `
Génère les métadonnées SEO pour cette photo de bien immobilier${locationStr} :
{
  "altText": "description image SEO (max 120 chars, français, mots-clés immo : pièce, superficie, caractéristiques)",
  "seoFileName": "nom-fichier-seo.jpg (max 60 chars, minuscules, tirets, ex: salon-lumineux-appartement-paris.jpg)",
  "description": "description courte pour annonce (max 200 chars, accrocheur, caractéristiques clés)",
  "keywords": "[\"mot-clé1\",\"mot-clé2\",\"mot-clé3\",\"mot-clé4\",\"mot-clé5\"]",
  "metaTitle": "titre SEO page annonce (max 60 chars)",
  "hashtags": "",
  "seoSchemaJson": "{\"@context\":\"https://schema.org\",\"@type\":\"RealEstateListing\",\"name\":\"[titre]\",\"description\":\"[desc]\",\"image\":\"[IMAGE_URL]\"}"
}`,
    INSTAGRAM: `
Génère les métadonnées SEO et hashtags pour ce post Instagram :
{
  "altText": "description image SEO Instagram (max 120 chars, français)",
  "seoFileName": "nom-fichier-seo.jpg (max 60 chars, minuscules, tirets)",
  "description": "caption Instagram accrocheur (max 200 chars)",
  "keywords": "[\"mot-clé1\",\"mot-clé2\",\"mot-clé3\",\"mot-clé4\",\"mot-clé5\"]",
  "metaTitle": "",
  "hashtags": "#hashtag1 #hashtag2 #hashtag3 ... (20 hashtags français et anglais pertinents, séparés par espaces)",
  "seoSchemaJson": ""
}`,
    VINTED: `
Génère les métadonnées SEO pour cette annonce Vinted :
{
  "altText": "description image (max 120 chars, français, type vêtement, couleur, marque si visible)",
  "seoFileName": "nom-fichier-seo.jpg (max 60 chars, ex: robe-ete-bleue-zara.jpg)",
  "description": "description annonce Vinted (max 200 chars, état, matière, taille si visible)",
  "keywords": "[\"mot-clé1\",\"mot-clé2\",\"mot-clé3\",\"mot-clé4\",\"mot-clé5\"]",
  "metaTitle": "",
  "hashtags": "",
  "seoSchemaJson": ""
}`,
    SHOPIFY: `
Génère les métadonnées SEO e-commerce pour ce produit Shopify :
{
  "altText": "description image produit SEO (max 120 chars, français, nom produit, caractéristiques visuelles)",
  "seoFileName": "nom-produit-seo.jpg (max 60 chars, minuscules, tirets)",
  "description": "description produit e-commerce (max 200 chars, bénéfices, matériaux, usage)",
  "keywords": "[\"mot-clé1\",\"mot-clé2\",\"mot-clé3\",\"mot-clé4\",\"mot-clé5\"]",
  "metaTitle": "titre SEO produit (max 60 chars, ex: Robe d'été fleurie bleue - Collection 2025)",
  "hashtags": "",
  "seoSchemaJson": "{\"@context\":\"https://schema.org\",\"@type\":\"Product\",\"name\":\"[nom produit]\",\"description\":\"[description]\",\"image\":\"[IMAGE_URL]\",\"offers\":{\"@type\":\"Offer\",\"priceCurrency\":\"EUR\"}}"
}`,
  };

  const promptTemplate = seoPrompts[preset] ?? seoPrompts["SHOPIFY"];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 600,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" },
          },
          {
            type: "text",
            text: `Tu es un expert SEO spécialisé en ${context}. Analyse cette photo et réponds UNIQUEMENT en JSON valide :
${promptTemplate}

IMPORTANT : Le champ "keywords" doit être un JSON array valide entre guillemets. Tous les champs doivent être des strings.`,
          },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  try {
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);

    // Normaliser keywords : si c'est déjà un array, le sérialiser
    let keywords = "";
    if (Array.isArray(parsed.keywords)) {
      keywords = JSON.stringify(parsed.keywords);
    } else if (typeof parsed.keywords === "string" && parsed.keywords.trim()) {
      keywords = parsed.keywords;
    }

    return {
      altText: String(parsed.altText ?? "Photo optimisée par Pictaura"),
      seoFileName: String(parsed.seoFileName ?? "photo-optimisee.jpg"),
      description: String(parsed.description ?? "Photo optimisée par IA"),
      keywords,
      metaTitle: String(parsed.metaTitle ?? ""),
      hashtags: String(parsed.hashtags ?? ""),
      seoSchemaJson: String(parsed.seoSchemaJson ?? ""),
    };
  } catch {
    return {
      altText: "Photo optimisée par Pictaura",
      seoFileName: "photo-optimisee.jpg",
      description: "Photo optimisée par IA",
      keywords: "",
      metaTitle: "",
      hashtags: "",
      seoSchemaJson: "",
    };
  }
}

/**
 * Note une photo sur 10 selon les critères de la plateforme.
 */
export async function scorePhoto(
  imageBase64: string,
  preset: Preset
): Promise<{ score: number; report: string }> {
  const criteriaMap: Record<string, string> = {
    AIRBNB: "luminosité, cadrage (règle des tiers), propreté/rangement, attractivité de la pièce, qualité d'image",
    IMMOBILIER: "luminosité, cadrage (règle des tiers), propreté/rangement, attractivité du bien, qualité d'image professionnelle",
    INSTAGRAM: "composition, couleurs, impact visuel, originalité, qualité d'image",
    VINTED: "netteté du produit, fond propre, éclairage uniforme, cadrage du produit, lisibilité des détails",
    SHOPIFY: "fond blanc ou neutre, netteté produit, éclairage professionnel, cadrage centré, qualité e-commerce",
  };
  const criteria = criteriaMap[preset] ?? criteriaMap["SHOPIFY"];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 400,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" },
          },
          {
            type: "text",
            text: `Tu es un expert photographe professionnel spécialisé dans les plateformes en ligne.
Évalue cette photo pour la plateforme ${preset} selon ces critères : ${criteria}.

Réponds en JSON :
{
  "score": <nombre entre 0 et 10, une décimale autorisée>,
  "report": "<2-3 phrases concises en français : points forts, points faibles, et si applicable ce qui a été amélioré par le traitement IA>"
}`,
          },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  try {
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      score: Math.min(10, Math.max(0, Number(parsed.score))),
      report: String(parsed.report),
    };
  } catch {
    return { score: 7, report: "Photo traitée avec succès." };
  }
}

/**
 * Génère un prompt d'inpainting optimisé à partir d'une instruction utilisateur.
 */
export async function generateInpaintingPrompt(
  imageBase64: string,
  userInstruction: string,
  preset: Preset
): Promise<{ prompt: string; negativePrompt: string }> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 500,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" },
          },
          {
            type: "text",
            text: `Tu es un expert en retouche photo IA. L'utilisateur veut modifier cette photo avec l'instruction suivante :

"${userInstruction}"

Contexte : photo pour ${preset}.

Génère en JSON un prompt optimisé pour FLUX inpainting (en anglais, très descriptif, style photographique professionnel) :
{
  "prompt": "<prompt positif pour Stable Diffusion/FLUX : décrit précisément ce qu'on veut voir, style photo professionnelle, haute qualité>",
  "negativePrompt": "<ce qu'on ne veut PAS : low quality, blurry, distorted, watermark, etc.>"
}

UNIQUEMENT du JSON valide.`,
          },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  try {
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return {
      prompt: userInstruction,
      negativePrompt: "low quality, blurry, distorted",
    };
  }
}
