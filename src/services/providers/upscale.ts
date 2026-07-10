/**
 * Upscale ESRGAN via fal — chaîné derrière le provider image quand la sortie
 * est sous le standard immo (les portails veulent du 1920px+ ; FLUX Kontext
 * sort ~1 Mpx, ex: 1392×752).
 *
 * NON-BLOQUANT par conception : le moindre échec (clé absente, timeout, coût,
 * schéma inattendu) retourne l'image ORIGINALE — une photo à 1392px livrée
 * vaut toujours mieux qu'une photo en échec. Coût ~1 ct, latence ~1-5 s.
 *
 * Config : UPSCALE_ENABLED ("false" pour couper — défaut actif),
 *          UPSCALE_MIN_EDGE (défaut 1920 : en-dessous, on upscale ×2).
 */
import sharp from "sharp";
import { recordImageCall, classifyImageError } from "@/services/monitoring/image-metrics";

const FAL_UPSCALE_MODEL = "fal-ai/esrgan";
const FAL_LABEL = `fal:${FAL_UPSCALE_MODEL}`;
const UPSCALE_COST_CENTS = 1;
const TIMEOUT_MS = 60_000;

const num = (v: string | undefined, dflt: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

export async function upscaleIfNeeded(buffer: Buffer): Promise<Buffer> {
  try {
    if (process.env.UPSCALE_ENABLED === "false") return buffer;
    if (!process.env.FAL_KEY) return buffer;

    const minEdge = num(process.env.UPSCALE_MIN_EDGE, 1920);
    const meta = await sharp(buffer).metadata();
    const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (longEdge === 0 || longEdge >= minEdge) return buffer; // déjà assez grand

    const t0 = Date.now();
    try {
      const res = await fetch(`https://fal.run/${FAL_UPSCALE_MODEL}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${process.env.FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: `data:image/jpeg;base64,${buffer.toString("base64")}`,
          scale: 2,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`fal HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
      }

      // Schéma esrgan : { image: {url} } — on tolère aussi { images: [{url}] }
      const json = (await res.json()) as {
        image?: { url?: string };
        images?: Array<{ url?: string }>;
      };
      const url = json.image?.url ?? json.images?.[0]?.url;
      if (!url) throw new Error("esrgan: aucune image retournée");

      let out: Buffer;
      if (url.startsWith("data:")) {
        out = Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
      } else {
        const imgRes = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        if (!imgRes.ok) throw new Error(`esrgan: téléchargement impossible (HTTP ${imgRes.status})`);
        out = Buffer.from(await imgRes.arrayBuffer());
      }

      // Sanity check : le résultat doit être réellement plus grand
      const outMeta = await sharp(out).metadata();
      if ((outMeta.width ?? 0) <= (meta.width ?? 0)) throw new Error("esrgan: sortie pas plus grande");

      recordImageCall({
        kind: "real",
        success: true,
        latencyMs: Date.now() - t0,
        model: FAL_LABEL,
        costCents: UPSCALE_COST_CENTS,
      });
      return out;
    } catch (err) {
      recordImageCall({
        kind: "real",
        success: false,
        latencyMs: Date.now() - t0,
        model: FAL_LABEL,
        errorCode: classifyImageError(err),
      });
      console.warn("Upscale ESRGAN échoué (non-bloquant, image originale conservée):", err instanceof Error ? err.message : err);
      return buffer;
    }
  } catch {
    return buffer; // même un échec de lecture des métadonnées ne bloque jamais
  }
}
