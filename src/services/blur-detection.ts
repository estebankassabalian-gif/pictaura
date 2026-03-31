import sharp from "sharp";

/**
 * Détecte si une image est floue via la variance du filtre Laplacien.
 * - Haute variance = image nette (beaucoup de contours)
 * - Faible variance = image floue (peu de contours)
 *
 * Seuil empirique : < 80 = très flou, 80-200 = acceptable, > 200 = net
 */
export async function detectBlur(
  inputBuffer: Buffer
): Promise<{ isBlurry: boolean; score: number; message: string | null }> {
  try {
    // Réduire à 400px pour accélérer (la détection ne nécessite pas haute résolution)
    const small = await sharp(inputBuffer)
      .rotate()
      .resize(400, 400, { fit: "inside" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Appliquer un filtre Laplacien via convolve et mesurer la variance
    const laplacian = await sharp(small.data, {
      raw: { width: small.info.width, height: small.info.height, channels: 1 },
    })
      .convolve({
        width: 3,
        height: 3,
        kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
      })
      .raw()
      .toBuffer();

    // Calculer la variance des pixels du filtre Laplacien
    const pixels = new Uint8Array(laplacian);
    let sum = 0;
    let sumSq = 0;
    const n = pixels.length;

    for (let i = 0; i < n; i++) {
      sum += pixels[i];
      sumSq += pixels[i] * pixels[i];
    }

    const mean = sum / n;
    const variance = sumSq / n - mean * mean;

    // Seuil : variance < 60 → très flou, < 100 → un peu flou
    const isBlurry = variance < 60;
    const message = isBlurry
      ? `Photo détectée comme floue (score netteté : ${variance.toFixed(0)}). Le résultat pourrait être décevant.`
      : null;

    return { isBlurry, score: Math.round(variance), message };
  } catch {
    // En cas d'erreur, on laisse passer (ne pas bloquer l'upload)
    return { isBlurry: false, score: 999, message: null };
  }
}
