/**
 * Sonde canary du chemin image — logique partagée entre la route
 * POST /api/cron/canary (déclenchement externe) et le scheduler interne
 * (instrumentation.ts) qui la lance toutes les CANARY_INTERVAL_MIN.
 *
 * Un seul appel image minimal, SANS retries : le canary doit refléter l'état
 * brut du provider primaire actif, pas le masquer.
 */
import sharp from "sharp";
import { runProviderCanary } from "@/services/providers";
import { alertWithCooldown } from "@/services/monitoring/image-metrics";

const num = (v: string | undefined, dflt: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

export type CanaryResult =
  | { ok: true; provider: string; latencyMs: number; slow: boolean }
  | { ok: false; error: string };

export async function runCanaryProbe(): Promise<CanaryResult> {
  const maxLatencyMs = num(process.env.CANARY_MAX_LATENCY_MS, 30_000);
  const cooldownMin = num(process.env.ALERT_COOLDOWN_MIN, 15);

  // Mini-image générée à la volée : la plus petite charge possible.
  const testImage = await sharp({
    create: { width: 256, height: 256, channels: 3, background: { r: 112, g: 122, b: 136 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();

  try {
    // Timeout = seuil + marge : distinguer "lent" (répond au-delà du seuil)
    // de "mort" (ne répond pas du tout).
    const { provider, latencyMs } = await runProviderCanary(
      testImage.toString("base64"),
      maxLatencyMs + 15_000
    );

    if (latencyMs > maxLatencyMs) {
      await alertWithCooldown(
        "canary",
        cooldownMin,
        `🐤 PICTAURA canary — provider image "${provider}" LENT : ${(latencyMs / 1000).toFixed(1)}s (seuil ${(maxLatencyMs / 1000).toFixed(0)}s). Les clients attendent probablement.`
      );
      return { ok: true, provider, latencyMs, slow: true };
    }
    return { ok: true, provider, latencyMs, slow: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 180) : "erreur inconnue";
    await alertWithCooldown(
      "canary",
      cooldownMin,
      `🚨 PICTAURA canary — le provider image primaire NE RÉPOND PLUS.\n${msg}\n→ Les retouches clients sont probablement en panne (ou basculées sur le secours).`
    );
    return { ok: false, error: msg };
  }
}

// ── Scheduler interne (mono-instance, dans le process web) ──────────────
// Le MONITORING_SPEC prévoyait "cron externe OU scheduler interne" : interne
// = zéro config Coolify, la sonde vit tant que l'app tourne. Si tout le
// serveur tombe, c'est l'uptime monitor externe sur /api/health/image qui
// prend le relais (le canary ne pourrait rien signaler de toute façon).
declare global {
  // eslint-disable-next-line no-var
  var __pictauraCanaryTimer: NodeJS.Timeout | undefined;
}

export function startCanaryScheduler(): void {
  if (process.env.CANARY_ENABLED !== "true") return;
  if (globalThis.__pictauraCanaryTimer) return; // déjà programmé (HMR/double register)

  const intervalMs = num(process.env.CANARY_INTERVAL_MIN, 45) * 60_000;
  const firstDelayMs = 3 * 60_000; // laisser l'app finir de démarrer

  const tick = () => {
    runCanaryProbe()
      .then((r) =>
        console.log(
          r.ok
            ? `Canary OK — ${r.provider} en ${(r.latencyMs / 1000).toFixed(1)}s${r.slow ? " (LENT)" : ""}`
            : `Canary ÉCHEC — ${r.error}`
        )
      )
      .catch((e) => console.error("Canary crash:", e));
  };

  globalThis.__pictauraCanaryTimer = setTimeout(() => {
    tick();
    globalThis.__pictauraCanaryTimer = setInterval(tick, intervalMs);
  }, firstDelayMs);

  console.log(`Canary scheduler actif : première sonde dans 3 min, puis toutes les ${intervalMs / 60_000} min`);
}
