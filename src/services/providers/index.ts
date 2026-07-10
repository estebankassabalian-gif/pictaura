/**
 * Orchestrateur de providers image : sélection, kill-switch, circuit breaker,
 * bascule automatique vers le secours + alerte Telegram.
 *
 * Routage (variables d'env, changeables dans Coolify SANS redéploiement) :
 *   IMAGE_PROVIDER_OVERRIDE  kill-switch : épingle un provider, court-circuite
 *                            breaker ET failover (retour au connu-bon en 1 var)
 *   IMAGE_PROVIDER_PRIMARY   'gemini' (défaut tant que la validation qualité
 *                            humaine n'est pas passée) | 'fal'
 *   IMAGE_PROVIDER_FALLBACK  secours explicite ; défaut : 'gemini' si le
 *                            primaire est 'fal', sinon aucun
 *
 * Circuit breaker (mono-instance, en mémoire — assumé par le plan) :
 *   BREAKER_THRESHOLD  échecs consécutifs avant ouverture (défaut 4)
 *   BREAKER_OPEN_S     durée d'ouverture → trafic dirigé vers le secours (défaut 120 s)
 */
import { GeminiProvider } from "./gemini-provider";
import { FalProvider } from "./fal-provider";
import { hasPromptInjection } from "@/lib/gemini";
import { alertWithCooldown } from "@/services/monitoring/image-metrics";
import type { ImageEditArgs, ImageEditProvider } from "./types";

const PROVIDERS: Record<string, ImageEditProvider> = {
  gemini: new GeminiProvider(),
  fal: new FalProvider(),
};

const num = (v: string | undefined, dflt: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

// État breaker par provider (mono-instance)
const breaker: Record<string, { fails: number; openUntil: number }> = {};

function breakerState(name: string) {
  return (breaker[name] ??= { fails: 0, openUntil: 0 });
}

function resolve(name: string | undefined | null): ImageEditProvider | null {
  if (!name) return null;
  const p = PROVIDERS[name.trim().toLowerCase()];
  return p && p.isConfigured() ? p : null;
}

/** Provider primaire effectif (override > primaire configuré > gemini). */
export function getPrimaryProvider(): ImageEditProvider {
  const override = resolve(process.env.IMAGE_PROVIDER_OVERRIDE);
  if (override) return override;
  const primary = resolve(process.env.IMAGE_PROVIDER_PRIMARY);
  if (primary) return primary;
  return PROVIDERS.gemini; // défaut historique — jamais null
}

function getFallbackProvider(primaryName: string): ImageEditProvider | null {
  if (process.env.IMAGE_PROVIDER_OVERRIDE) return null; // kill-switch : pas de failover
  const explicit = resolve(process.env.IMAGE_PROVIDER_FALLBACK);
  if (explicit && explicit.name !== primaryName) return explicit;
  // Défaut : si le primaire n'est pas gemini, gemini reste le secours connu-bon
  if (primaryName !== "gemini" && PROVIDERS.gemini.isConfigured()) return PROVIDERS.gemini;
  return null;
}

/**
 * Point d'entrée UNIQUE du pipeline et de l'inpainting pour éditer une image.
 * Le provider retourne une image brute ; crop/watermark/EXIF restent au pipeline.
 */
export async function editImage(args: ImageEditArgs): Promise<Buffer> {
  if (hasPromptInjection(args.instruction.slice(0, 1200))) {
    throw new Error("Instruction refusée : contenu non autorisé détecté");
  }

  const threshold = num(process.env.BREAKER_THRESHOLD, 4);
  const openMs = num(process.env.BREAKER_OPEN_S, 120) * 1000;
  const cooldownMin = num(process.env.ALERT_COOLDOWN_MIN, 15);

  const primary = getPrimaryProvider();
  const fallback = getFallbackProvider(primary.name);
  const st = breakerState(primary.name);

  // Breaker ouvert ET un secours existe → secours direct (sinon on tente quand même)
  if (fallback && Date.now() < st.openUntil) {
    return fallback.editImage(args);
  }

  try {
    const out = await primary.editImage(args);
    st.fails = 0; // succès → reset
    return out;
  } catch (primaryErr) {
    st.fails++;
    if (st.fails >= threshold && Date.now() >= st.openUntil) {
      st.openUntil = Date.now() + openMs;
      void alertWithCooldown(
        "breaker",
        cooldownMin,
        `🔌 PICTAURA — circuit breaker OUVERT sur "${primary.name}" (${st.fails} échecs consécutifs).` +
          (fallback
            ? `\nBascule automatique sur "${fallback.name}" pendant ${Math.round(openMs / 1000)}s.`
            : `\n⚠️ AUCUN secours configuré : les retouches échouent.`)
      );
    }
    if (!fallback) throw primaryErr;
    // Bascule immédiate sur le secours pour CETTE requête
    return fallback.editImage(args);
  }
}

/** Canary : sonde le provider primaire ACTIF (sans failover — on veut la vérité). */
export async function runProviderCanary(
  imageBase64: string,
  timeoutMs: number
): Promise<{ provider: string; latencyMs: number }> {
  const primary = getPrimaryProvider();
  const t0 = Date.now();
  await primary.editImage({
    imageBase64,
    instruction: "Slightly increase brightness. Keep everything else identical.",
    systemPrompt: "You are a professional photo editor.",
    kind: "canary",
    timeoutMs,
  });
  return { provider: primary.name, latencyMs: Date.now() - t0 };
}
