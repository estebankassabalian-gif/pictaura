/**
 * Rehaussement photométrique déterministe (Sharp) — appliqué derrière le
 * provider image quand celui-ci est FLUX Kontext (fal).
 *
 * POURQUOI : Kontext est un éditeur d'OBJETS (retirer une voiture, assainir
 * une piscine) dont le biais de conception est de préserver l'image — il est
 * faible sur le rehaussement GLOBAL (exposition/HDR/éclat), cœur de la
 * retouche immo. Résultat constaté : rendu "sombre, terne". Ce module apporte
 * le lift photométrique de façon déterministe, locale, gratuite (~100 ms),
 * calibrée par métier. Validé visuellement sur photos réelles (villa Var).
 *
 * Gemini (Nano Banana) rehausse déjà globalement → on ne double-traite pas.
 * Kill-switch : POST_ENHANCE_ENABLED=false.
 */
import sharp from "sharp";

type EnhanceParams = {
  brightness: number; // multiplicateur d'exposition
  saturation: number; // multiplicateur de saturation
  contrastA: number;  // linear(a, b) — pente
  contrastB: number;  // linear(a, b) — offset
  sharpenSigma: number;
};

// Calibrage par preset : immo = lumineux/éclatant (annonce premium),
// social = punchy, e-commerce = LÉGER (fidélité couleurs/matières impérative).
const PARAMS: Record<string, EnhanceParams> = {
  AIRBNB:     { brightness: 1.07, saturation: 1.18, contrastA: 1.07, contrastB: -9,  sharpenSigma: 0.9 },
  IMMOBILIER: { brightness: 1.07, saturation: 1.18, contrastA: 1.07, contrastB: -9,  sharpenSigma: 0.9 },
  INSTAGRAM:  { brightness: 1.05, saturation: 1.22, contrastA: 1.08, contrastB: -10, sharpenSigma: 0.8 },
  VINTED:     { brightness: 1.05, saturation: 1.07, contrastA: 1.04, contrastB: -4,  sharpenSigma: 0.7 },
  SHOPIFY:    { brightness: 1.05, saturation: 1.07, contrastA: 1.04, contrastB: -4,  sharpenSigma: 0.7 },
};

/**
 * Applique le rehaussement du preset. Non-bloquant : tout échec retourne
 * l'image d'origine.
 */
export async function postEnhance(buffer: Buffer, preset: string): Promise<Buffer> {
  try {
    if (process.env.POST_ENHANCE_ENABLED === "false") return buffer;
    const p = PARAMS[preset] ?? PARAMS.IMMOBILIER;
    return await sharp(buffer)
      .modulate({ brightness: p.brightness, saturation: p.saturation })
      .linear(p.contrastA, p.contrastB)
      .sharpen({ sigma: p.sharpenSigma })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.warn("postEnhance échoué (non-bloquant):", err instanceof Error ? err.message : err);
    return buffer;
  }
}
