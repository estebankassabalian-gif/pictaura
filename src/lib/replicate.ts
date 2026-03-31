import Replicate from "replicate";
import { env } from "@/config/env";

export const replicate = new Replicate({
  auth: env.REPLICATE_API_TOKEN,
});

// ─── Model versions ─────────────────────────────────────────

export const REPLICATE_MODELS = {
  // Real-ESRGAN : upscaling / débruitage
  // ~$0.0023 par run
  REAL_ESRGAN: "nightmareai/real-esrgan:b3ef194191d13140337468c916c2c5b96dd0cb06dffc032a022a31807f6a5ea8",

  // Remove background : fond blanc pour Vinted/Shopify
  // ~$0.002 par run
  REMOVE_BG: "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",

  // FLUX Fill Pro : inpainting haute qualité (nécessite un masque)
  // ~$0.05 par run
  FLUX_FILL_PRO: "black-forest-labs/flux-fill-pro",

  // InstructPix2Pix : retouche précise par instruction, sans masque
  // Conçu pour modifier uniquement ce qui est demandé
  INSTRUCT_PIX2PIX: "timothybrooks/instruct-pix2pix:30c1d0b916a6f8efce20493f5d61ee27491ab2a60437c13c588468b9810ec23f",
} as const;

/**
 * Lance real-esrgan sur une image (Buffer ou URL).
 * Retourne l'URL publique du résultat Replicate (temporaire ~1h).
 */
export async function runRealESRGAN(
  imageUrl: string,
  scale: 2 | 4 = 2
): Promise<string> {
  const output = await replicate.run(REPLICATE_MODELS.REAL_ESRGAN, {
    input: {
      image: imageUrl,
      scale,
      face_enhance: false,
    },
  });

  // SDK v1.x retourne FileOutput — .toString() donne l'URL
  const url = String(output);
  if (!url || url === "undefined") throw new Error("Replicate real-esrgan: résultat inattendu");
  return url;
}

/**
 * Supprime le fond d'une image.
 * Retourne l'URL publique du résultat (PNG avec transparence).
 */
export async function runRemoveBg(imageUrl: string): Promise<string> {
  const output = await replicate.run(REPLICATE_MODELS.REMOVE_BG, {
    input: { image: imageUrl },
  });

  const url = String(output);
  if (!url || url === "undefined") throw new Error("Replicate remove-bg: résultat inattendu");
  return url;
}

/**
 * Retouche par instruction texte via SDXL img2img.
 * Ne nécessite pas de masque — transforme l'image selon un prompt.
 * @param imageUrl - Image source
 * @param prompt - Prompt décrivant l'image finale souhaitée
 */
export async function runInstructPix2Pix(
  imageUrl: string,
  prompt: string
): Promise<string> {
  const output = await replicate.run(REPLICATE_MODELS.INSTRUCT_PIX2PIX, {
    input: {
      image: imageUrl,
      prompt,
      image_guidance_scale: 2.0,  // fidélité à l'image originale (1=ignore, 3=très fidèle)
      guidance_scale: 7.5,         // fidélité au prompt
      num_inference_steps: 30,
      num_outputs: 1,
    },
  });

  const urls = Array.isArray(output) ? output : [output];
  const url = String(urls[0]);
  if (!url || url === "undefined") throw new Error("Replicate SDXL: résultat inattendu");
  return url;
}

/**
 * Inpainting FLUX Fill Pro (nécessite un masque).
 * @param imageUrl - Image source
 * @param prompt - Prompt décrivant ce qu'on veut à la place
 * @param maskUrl - Masque (blanc = zone à remplacer)
 */
export async function runFluxInpainting(
  imageUrl: string,
  prompt: string,
  maskUrl?: string
): Promise<string> {
  const input: Record<string, unknown> = {
    image: imageUrl,
    prompt,
    num_inference_steps: 28,
    guidance_scale: 30,
    strength: 0.85,
  };

  if (maskUrl) {
    input.mask = maskUrl;
  }

  const output = await replicate.run(REPLICATE_MODELS.FLUX_FILL_PRO, {
    input,
  });

  const urls = Array.isArray(output) ? output : [output];
  const url = String(urls[0]);
  if (!url || url === "undefined") throw new Error("Replicate FLUX Fill Pro: résultat inattendu");
  return url;
}

/**
 * Télécharge une image depuis une URL Replicate et retourne un Buffer.
 * Les URLs Replicate expirent — toujours télécharger immédiatement.
 */
export async function downloadReplicateOutput(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Impossible de télécharger le résultat Replicate: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
