import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { runProviderCanary } from "@/services/providers";
import { alertWithCooldown } from "@/services/monitoring/image-metrics";

export const maxDuration = 60;

const num = (v: string | undefined, dflt: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

/**
 * POST /api/cron/canary — sonde synthétique du modèle IMAGE.
 * À appeler par un cron externe (Coolify / autre) toutes les CANARY_INTERVAL_MIN
 * (recommandé : 45 min — PAS 3 min, coût absurde). Couvre les périodes sans
 * trafic : une panne du modèle image déclenche une alerte Telegram même si
 * aucun client n'uploade.
 *
 * Protection : header `x-cron-secret` = env CRON_SECRET (route inutilisable si
 * CRON_SECRET absent). Activation : CANARY_ENABLED=true.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (process.env.CANARY_ENABLED !== "true") {
    return NextResponse.json({ skipped: true, reason: "CANARY_ENABLED != true" });
  }

  const maxLatencyMs = num(process.env.CANARY_MAX_LATENCY_MS, 30_000);
  const cooldownMin = num(process.env.ALERT_COOLDOWN_MIN, 15);

  // Mini-image générée à la volée : la plus petite charge possible.
  const testImage = await sharp({
    create: { width: 256, height: 256, channels: 3, background: { r: 112, g: 122, b: 136 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();

  try {
    // Sonde le provider PRIMAIRE ACTIF (sans failover : on veut la vérité).
    // Timeout d'appel = seuil de latence + marge, pour pouvoir distinguer
    // "lent" (répond au-delà du seuil) de "mort" (ne répond pas du tout).
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
      return NextResponse.json({ ok: true, slow: true, provider, latencyMs });
    }
    return NextResponse.json({ ok: true, provider, latencyMs });
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 180) : "erreur inconnue";
    await alertWithCooldown(
      "canary",
      cooldownMin,
      `🚨 PICTAURA canary — le provider image primaire NE RÉPOND PLUS.\n${msg}\n→ Les retouches clients sont probablement en panne (ou basculées sur le secours).`
    );
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
