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
  /**
   * Ratio cible de la plateforme sélectionnée (ex: "9:16", "1:1") — purement
   * compositionnel, aucun risque d'hallucination. Laisse le modèle composer
   * DIRECTEMENT au bon format au lieu de recadrer à l'aveugle après coup
   * (cropToPlatform en Sharp "attention" ne sait pas ce que le modèle a
   * réellement composé). Providers qui ne le supportent pas l'ignorent.
   */
  aspectRatio?: string;
}

export interface ImageEditResult {
  buffer: Buffer;
  /** Modèle qui a RÉELLEMENT servi cette requête (ex: 'fal:fal-ai/nano-banana-2/edit').
   *  Peut différer de modelLabel() si le provider a un filet interne (ex: fal
   *  bascule sur un modèle de secours après épuisement des retries du primaire).
   *  Le pipeline décide son post-traitement sur CE champ, jamais sur modelLabel(). */
  model: string;
}

export interface ImageEditProvider {
  /** Identifiant stable ('gemini' | 'fal') — utilisé par les env vars de routage */
  readonly name: string;
  /** false si la clé API du provider est absente (provider inéligible) */
  isConfigured(): boolean;
  /** Modèle PRIMAIRE configuré (ex: 'fal:fal-ai/nano-banana-2/edit') — pour
   *  affichage/health uniquement. Le modèle réellement utilisé est dans le
   *  résultat de editImage(). */
  modelLabel(): string;
  /** Retourne le buffer de l'image éditée + le modèle qui a servi. Throw en cas d'échec total. */
  editImage(args: ImageEditArgs): Promise<ImageEditResult>;
}
