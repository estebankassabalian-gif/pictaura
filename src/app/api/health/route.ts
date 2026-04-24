import { NextResponse } from "next/server";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { getR2 } from "@/lib/r2";
import { env } from "@/config/env";

/**
 * GET /api/health
 * Check de santé pour Coolify, uptime monitoring, ou diagnostic rapide.
 * 200 = tout vert · 503 = au moins un check en erreur (Coolify peut ainsi mark unhealthy).
 *
 * Vérifie : DB Postgres + bucket R2 + retourne le SHA du commit déployé.
 * Public : aucune authentification requise (mais ne fuit aucune info sensible).
 */
export async function GET() {
  const start = Date.now();

  const [dbResult, storageResult] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    getR2().send(new HeadBucketCommand({ Bucket: env.R2_BUCKET_NAME })),
  ]);

  const db = dbResult.status === "fulfilled" ? "ok" : "error";
  const storage = storageResult.status === "fulfilled" ? "ok" : "error";
  const allOk = db === "ok" && storage === "ok";

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      db,
      storage,
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
