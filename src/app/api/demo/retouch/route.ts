import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import sharp from "sharp";
import { editImage } from "@/services/providers";
import { AGENTS } from "@/config/agents";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  resizeIfLarger,
  GEMINI_INPUT_MAX_EDGE,
  DEFAULT_INSTRUCTIONS,
  GENERIC_INSTRUCTION,
} from "@/services/processing/pipeline";

const FALLBACK_SYSTEM_PROMPT =
  "You are a professional photo editor. Perform the requested edits with photorealistic, professional quality.";

export const maxDuration = 120;

/**
 * POST /api/demo/retouch — retouche UNE image publique pour la prospection.
 *
 * Sert la "démo personnalisée" du tunnel d'acquisition : on prend une photo
 * de l'annonce publique d'un prospect, on la passe dans le MÊME pipeline que
 * la production (providers + breaker + failover), et on renvoie avant/après.
 * Le composite et l'envoi sont faits côté script Python (pictaura-outreach).
 *
 * Pourquoi réutiliser editImage() plutôt que rappeler fal/Gemini côté script :
 * la démo DOIT être exactement ce que le prospect obtiendra en s'inscrivant.
 * Dupliquer les prompts ailleurs, c'est promettre un résultat qu'on ne livre pas.
 *
 * Volontairement HORS du flux crédits/watermark : aucun compte n'est débité,
 * aucun watermark n'est appliqué — c'est une dépense d'acquisition, pas une
 * livraison client. Le coût réel est suivi par le monitoring image habituel.
 *
 * Protection : header `x-demo-secret` = env DEMO_SECRET (absent = route morte).
 */

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

/** Bloque les cibles internes : cette route fetch une URL fournie par l'appelant (SSRF). */
function isPrivateAddress(ip: string): boolean {
  if (ip.startsWith("127.") || ip === "::1" || ip.startsWith("0.")) return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true; // link-local + métadonnées cloud
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  return false;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("URL invalide");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Protocole non autorisé");
  }
  const host = url.hostname;
  const ip = isIP(host) ? host : (await lookup(host)).address;
  if (isPrivateAddress(ip)) throw new Error("Cible interne refusée");
  return url;
}

/** Ratio supporté le plus proche de la source, pour que le modèle ne recadre pas. */
const SUPPORTED_RATIOS: Array<[string, number]> = [
  ["9:16", 9 / 16], ["2:3", 2 / 3], ["3:4", 3 / 4], ["4:5", 4 / 5],
  ["1:1", 1], ["5:4", 5 / 4], ["4:3", 4 / 3], ["3:2", 3 / 2],
  ["16:9", 16 / 9], ["21:9", 21 / 9],
];

function nearestAspectRatio(width?: number, height?: number): string | undefined {
  if (!width || !height) return undefined;
  const target = width / height;
  let best = SUPPORTED_RATIOS[0];
  for (const candidate of SUPPORTED_RATIOS) {
    if (Math.abs(candidate[1] - target) < Math.abs(best[1] - target)) best = candidate;
  }
  return best[0];
}

async function fetchImage(url: URL): Promise<Buffer> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "PictauraDemoBot/1.0 (+https://pictaura.app)" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Téléchargement impossible (HTTP ${res.status})`);

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_SOURCE_BYTES) throw new Error("Image source trop lourde");

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_SOURCE_BYTES) throw new Error("Image source trop lourde");
  if (buf.length < 1024) throw new Error("Image source vide ou illisible");
  return buf;
}

export async function POST(req: NextRequest) {
  const secret = process.env.DEMO_SECRET;
  if (!secret || req.headers.get("x-demo-secret") !== secret) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Garde-fou de dépense : la démo consomme du budget API sans revenu immédiat.
  if (!checkRateLimit("demo:global", 120, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Quota démo horaire atteint (120/h)" },
      { status: 429 }
    );
  }

  let body: { imageUrl?: string; preset?: string; resolution?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const presetKey = (body.preset ?? "IMMOBILIER").toUpperCase();
  if (!DEFAULT_INSTRUCTIONS[presetKey]) {
    return NextResponse.json(
      { error: `Preset inconnu : ${presetKey}` },
      { status: 400 }
    );
  }
  if (!body.imageUrl) {
    return NextResponse.json({ error: "imageUrl manquant" }, { status: 400 });
  }

  // Résolution du prompt à l'identique du pipeline : AGENTS ne couvre que
  // IMMOBILIER/INSTAGRAM/SHOPIFY, les autres presets retombent sur le
  // system prompt générique — exactement comme processJob().
  const systemPrompt = AGENTS[presetKey]?.systemPrompt ?? FALLBACK_SYSTEM_PROMPT;
  const instruction = DEFAULT_INSTRUCTIONS[presetKey] ?? GENERIC_INSTRUCTION;

  try {
    const url = await assertPublicUrl(body.imageUrl);
    const source = await fetchImage(url);

    // Normalisation identique au pipeline de prod : même entrée, même sortie.
    const normalized = await resizeIfLarger(source, GEMINI_INPUT_MAX_EDGE);

    // Le ratio de la source est imposé au modèle. Sans lui, nano-banana
    // compose au format qu'il juge bon et RECADRE la scène : mesuré sur des
    // agences réelles, l'écart de contours passait de ~5 à ~11 sur 255, soit
    // une photo visiblement recomposée. Or une démo recomposée envoyée au
    // propriétaire de la photo est pire que pas de démo du tout.
    const srcMeta = await sharp(normalized).metadata();
    const aspectRatio = nearestAspectRatio(srcMeta.width, srcMeta.height);

    const edited = await editImage({
      imageBase64: normalized.toString("base64"),
      instruction,
      systemPrompt,
      aspectRatio,
      resolution: body.resolution ?? "2K",
    });

    // L'avant est renvoyé TEL QUEL, jamais recadré au format de l'après :
    // le forcer en `cover` masquait précisément le recadrage qu'on cherche à
    // détecter, et rendait la comparaison mensongère.
    const before = await sharp(normalized)
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    const after = await sharp(edited.buffer)
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    const afterMeta = await sharp(after).metadata();

    return NextResponse.json({
      ok: true,
      model: edited.model,
      provider: edited.provider,
      width: afterMeta.width ?? null,
      height: afterMeta.height ?? null,
      beforeBase64: before.toString("base64"),
      afterBase64: after.toString("base64"),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("Demo retouch error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
