/**
 * Sonde canary du chemin image — logique partagée entre la route
 * POST /api/cron/canary (déclenchement externe) et le scheduler interne
 * (instrumentation.ts) qui la lance toutes les CANARY_INTERVAL_MIN.
 *
 * Un seul appel image minimal, SANS retries : le canary doit refléter l'état
 * brut du provider primaire actif, pas le masquer.
 */
import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";
import { runProviderCanary } from "@/services/providers";
import { alertWithCooldown } from "@/services/monitoring/image-metrics";
import { getQueueWorkerStatus } from "@/services/processing/queue";
import { prisma } from "@/lib/prisma";

const num = (v: string | undefined, dflt: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

export type CanaryResult =
  | { ok: true; provider: string; latencyMs: number; slow: boolean }
  | { ok: false; error: string };

/**
 * Contrôle du worker de traitement, indépendant de la sonde provider : il doit
 * tourner à chaque tick, y compris quand la sonde image est sautée.
 */
export async function checkQueueWorkerAndAlert(): Promise<void> {
  // Le worker pg-boss peut mourir sans que le processus s'arrête (connexion
  // Postgres perdue, erreur non rattrapée dans boss.work). L'application
  // répond alors normalement, /api/health l'indique — mais personne ne
  // regarde /api/health. Les lots restent PENDING jusqu'au balayage de
  // job-recovery, qui rembourse au lieu de traiter : le client paie en
  // attente et repart sans photos. On le signale ici, puisque la sonde
  // tourne déjà périodiquement dans le même processus.
  const worker = getQueueWorkerStatus();
  if (worker !== "ok") {
    await alertWithCooldown(
      "canary",
      num(process.env.ALERT_COOLDOWN_MIN, 15),
      `⚙️ PICTAURA — WORKER DE TRAITEMENT À L'ARRÊT

` +
      `État : ${worker}

` +
      `Les lots photo ne sont plus traités. Redéployer l'application relance le worker.`
    );
  }
}

export async function runCanaryProbe(): Promise<CanaryResult> {
  await checkQueueWorkerAndAlert();

  const maxLatencyMs = num(process.env.CANARY_MAX_LATENCY_MS, 30_000);
  const cooldownMin = num(process.env.ALERT_COOLDOWN_MIN, 15);

  // Vraie photo (pas un rectangle de couleur unie) : un aplat sans texture ni
  // sujet ne donne au modèle rien à éditer, ce qui lui fait parfois échouer
  // sa génération ("did not generate the expected output") — constaté en
  // prod (canary 2026-09-08), faux positif sans rapport avec un vrai souci
  // de contenu. Réutilise une photo de démo déjà présente dans public/,
  // redimensionnée pour rester une charge minimale.
  const demoPhoto = await readFile(path.join(process.cwd(), "public/demo/villa-avant.jpg"));
  const testImage = await sharp(demoPhoto)
    .resize(512, 512, { fit: "inside" })
    .jpeg({ quality: 75 })
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
    // Rejet par le filtre de contenu ≠ panne : le provider répond, il a juste
    // refusé CE prompt (constaté probabiliste sur la sonde). Message distinct
    // pour ne pas crier "panne" à tort.
    const isContentPolicy = /content.?policy|flagged/i.test(msg);
    await alertWithCooldown(
      "canary",
      cooldownMin,
      isContentPolicy
        ? `⚠️ PICTAURA canary — sonde REJETÉE par le filtre de contenu du provider (faux positif probable, pas une panne).\n${msg}\n→ Si cette alerte se répète plusieurs fois d'affilée, vérifier qu'une vraie retouche passe.`
        : `🚨 PICTAURA canary — le provider image primaire NE RÉPOND PLUS.\n${msg}\n→ Les retouches clients sont probablement en panne (ou basculées sur le secours).`
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

/**
 * true si la sonde image est inutile pour ce tick : un appel réel a réussi
 * dans l'intervalle ET la dernière sonde n'était pas en échec. En cas de
 * doute (lecture impossible), false : mieux vaut une sonde de trop.
 */
export async function isCanaryProbeRedundant(intervalMs: number): Promise<boolean> {
  try {
    const [lastCanary, recentRealSuccess] = await Promise.all([
      prisma.imageCallEvent.findFirst({
        where: { kind: "canary" },
        orderBy: { createdAt: "desc" },
        select: { success: true },
      }),
      prisma.imageCallEvent.findFirst({
        where: { kind: "real", success: true, createdAt: { gte: new Date(Date.now() - intervalMs) } },
        select: { id: true },
      }),
    ]);
    return Boolean(recentRealSuccess) && lastCanary?.success !== false;
  } catch (e) {
    console.warn("Canary : lecture du trafic impossible, sonde lancée par défaut", e);
    return false;
  }
}

export function startCanaryScheduler(): void {
  if (process.env.CANARY_ENABLED !== "true") return;
  if (globalThis.__pictauraCanaryTimer) return; // déjà programmé (HMR/double register)

  const intervalMs = num(process.env.CANARY_INTERVAL_MIN, 45) * 60_000;
  const firstDelayMs = 3 * 60_000; // laisser l'app finir de démarrer

  let firstTick = true;
  const tick = async () => {
    const isFirst = firstTick;
    firstTick = false;
    // Sonde adaptative : un appel réel réussi depuis le dernier tick prouve
    // déjà que le provider répond — et, s'il tombait pendant le trafic, la
    // règle de taux d'échec alerterait avant la sonde. La sonde (~8 ct) ne
    // sert qu'à couvrir les périodes SANS trafic : c'est là qu'une panne
    // passerait inaperçue jusqu'au premier client.
    // Jamais sautée : au démarrage (vérification post-déploiement) ni après
    // une sonde en échec (seule une sonde réussie efface l'état "dégradé"
    // de /api/health/image).
    if (!isFirst && (await isCanaryProbeRedundant(intervalMs))) {
      await checkQueueWorkerAndAlert();
      console.log("Canary sauté : trafic réel réussi depuis le dernier passage");
      return;
    }
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
