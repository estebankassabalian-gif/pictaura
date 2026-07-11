/**
 * Couche provider image (P2 du plan de refonte).
 *
 * Contrat NON NÉGOCIABLE (pipeline provider-agnostique, §3.3 du plan) :
 * un provider reçoit une image + une instruction et retourne une IMAGE BRUTE.
 * Il ne fait NI crop, NI watermark, NI EXIF — cette chaîne appartient au
 * pipeline et s'exécute à l'identique quel que soit le modèle, sinon la
 * promesse SEO/watermark casse au premier changement de provider.
 */
export interface ImageEditArgs {
  imageBase64: string;
  instruction: string;
  systemPrompt: string;
  /** 'canary' = sonde monitoring (1 tentative, pas de retries) */
  kind?: "real" | "canary";
  /** Timeout par tentative (canary uniquement — les providers ont leurs défauts) */
  timeoutMs?: number;
}

export interface ImageEditProvider {
  /** Identifiant stable ('gemini' | 'fal') — utilisé par les env vars de routage */
  readonly name: string;
  /** false si la clé API du provider est absente (provider inéligible) */
  isConfigured(): boolean;
  /** Modèle effectif (ex: 'fal:fal-ai/nano-banana-2/edit') — le pipeline
   *  adapte son post-traitement selon le modèle, pas selon le provider. */
  modelLabel(): string;
  /** Retourne le buffer de l'image éditée. Throw en cas d'échec. */
  editImage(args: ImageEditArgs): Promise<Buffer>;
}
