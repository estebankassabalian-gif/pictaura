/**
 * Rehaussement photométrique ADAPTATIF (Sharp) — appliqué derrière le
 * provider image quand celui-ci est FLUX Kontext (fal).
 *
 * POURQUOI : Kontext est un éditeur d'OBJETS à biais de préservation —
 * excellent "retire la voiture / assainis la piscine", faible sur le
 * rehaussement GLOBAL (exposition/HDR/éclat), cœur de la retouche immo.
 * Constaté en prod : rendu "sombre, terne".
 *
 * ADAPTATIF : un lift fixe (+7 %) était invisible sur une photo sombre.
 * Ici on MESURE la luminance moyenne de l'image et on calcule le lift
 * nécessaire pour atteindre une exposition d'annonce (~cible 132/255),
 * borné pour ne jamais surcuire : photo sombre → jusqu'à +40 %, photo
 * déjà claire → quasi rien. Local, gratuit, ~100 ms, déterministe.
 *
 * Kill-switch : POST_ENHANCE_ENABLED=false.
 */
import sharp from "sharp";

type PresetParams = {
  targetLum: number;   // luminance moyenne visée (0-255)
  maxLift: number;     // plafond du multiplicateur d'exposition
  saturation: number;
  contrastA: number;   // linear(a, b)
  contrastB: number;
  sharpenSigma: number;
};

// Immo = lumineux/éclatant (annonce premium) ; social = punchy ;
// e-commerce = LÉGER et fidèle (couleurs/matières exactes = confiance achat).
const PARAMS: Record<string, PresetParams> = {
  AIRBNB:     { targetLum: 134, maxLift: 1.4,  saturation: 1.16, contrastA: 1.06, contrastB: -7, sharpenSigma: 0.9 },
  IMMOBILIER: { targetLum: 134, maxLift: 1.4,  saturation: 1.16, contrastA: 1.06, contrastB: -7, sharpenSigma: 0.9 },
  INSTAGRAM:  { targetLum: 128, maxLift: 1.3,  saturation: 1.22, contrastA: 1.08, contrastB: -9, sharpenSigma: 0.8 },
  VINTED:     { targetLum: 130, maxLift: 1.25, saturation: 1.06, contrastA: 1.03, contrastB: -3, sharpenSigma: 0.7 },
  SHOPIFY:    { targetLum: 130, maxLift: 1.25, saturation: 1.06, contrastA: 1.03, contrastB: -3, sharpenSigma: 0.7 },
};

/**
 * Applique le rehaussement adaptatif du preset. Non-bloquant : tout échec
 * retourne l'image d'origine.
 */
export async function postEnhance(buffer: Buffer, preset: string): Promise<Buffer> {
  try {
    if (process.env.POST_ENHANCE_ENABLED === "false") return buffer;
    const p = PARAMS[preset] ?? PARAMS.IMMOBILIER;

    // Luminance moyenne mesurée (pondération perceptuelle Rec.601)
    const stats = await sharp(buffer).stats();
    const [r, g, b] = stats.channels;
    const lum = 0.299 * (r?.mean ?? 128) + 0.587 * (g?.mean ?? 128) + 0.114 * (b?.mean ?? 128);

    // Lift nécessaire pour atteindre la cible, borné [1.0, maxLift]
    const brightness = Math.min(p.maxLift, Math.max(1.0, p.targetLum / Math.max(lum, 1)));

    return await sharp(buffer)
      .modulate({ brightness, saturation: p.saturation })
      .linear(p.contrastA, p.contrastB)
      .sharpen({ sigma: p.sharpenSigma })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.warn("postEnhance échoué (non-bloquant):", err instanceof Error ? err.message : err);
    return buffer;
  }
}
