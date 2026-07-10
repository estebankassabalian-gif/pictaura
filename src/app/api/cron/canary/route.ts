import { NextRequest, NextResponse } from "next/server";
import { runCanaryProbe } from "@/services/monitoring/canary";

export const maxDuration = 60;

/**
 * POST /api/cron/canary — déclenchement EXTERNE de la sonde image.
 * Normalement inutile : le scheduler interne (instrumentation.ts) lance la
 * sonde toutes les CANARY_INTERVAL_MIN. Cette route reste pour un test manuel
 * ou un cron externe de ceinture-bretelles.
 *
 * Protection : header `x-cron-secret` = env CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (process.env.CANARY_ENABLED !== "true") {
    return NextResponse.json({ skipped: true, reason: "CANARY_ENABLED != true" });
  }

  const result = await runCanaryProbe();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
