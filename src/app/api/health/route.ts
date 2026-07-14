import { NextResponse, type NextRequest } from "next/server";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { getR2 } from "@/lib/r2";
import { pingGemini } from "@/lib/gemini";
import { getQueueWorkerStatus } from "@/services/processing/queue";
import { env } from "@/config/env";

/**
 * GET /api/health
 * Check de santé pour Coolify, uptime monitoring, ou diagnostic rapide.
 * 200 = tout vert · 503 = au moins un check en erreur (Coolify peut ainsi mark unhealthy).
 *
 * Vérifie : DB Postgres + bucket R2 + (optionnel) Gemini.
 * - `/api/health`         : DB + R2 (cheap, can be polled every 30s)
 * - `/api/health?deep=1`  : + ping Gemini (1 token, ~1s) pour détecter outage Google
 */
export async function GET(req: NextRequest) {
  const start = Date.now();
  const deep = req.nextUrl.searchParams.get("deep") === "1";

  const checks: Promise<unknown>[] = [
    prisma.$queryRaw`SELECT 1`,
    getR2().send(new HeadBucketCommand({ Bucket: env.R2_BUCKET_NAME })),
  ];
  if (deep) checks.push(pingGemini());

  const [dbResult, storageResult, geminiResult] = await Promise.allSettled(checks);

  const db = dbResult.status === "fulfilled" ? "ok" : "error";
  const storage = storageResult.status === "fulfilled" ? "ok" : "error";
  const gemini = deep
    ? geminiResult?.status === "fulfilled" ? "ok" : "error"
    : "skipped";

  const allOk = db === "ok" && storage === "ok" && (gemini === "ok" || gemini === "skipped");

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      db,
      storage,
      gemini,
      // "ok" = worker pg-boss enregistré (lancements de jobs durables actifs).
      // "not_started"/"error: ..." = les uploads passeraient quand même par le
      // remboursement automatique, mais aucun traitement ne démarrerait → à
      // surveiller après chaque deploy. N'affecte pas le status global (l'app
      // sert toujours ses pages) mais rend le problème VISIBLE.
      queueWorker: getQueueWorkerStatus(),
      version: process.env.NEXT_PUBLIC_BUILD_SHA ?? process.env.SOURCE_COMMIT ?? "unknown",
      uptime_ms: Math.round(process.uptime() * 1000),
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    },
    {
      status: allOk ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
