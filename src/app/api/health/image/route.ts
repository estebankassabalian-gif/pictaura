import { NextResponse } from "next/server";
import { getImageHealthSnapshot } from "@/services/monitoring/image-metrics";
import { getPrimaryProvider, hasResilienceFallback } from "@/services/providers";

/**
 * GET /api/health/image — santé du chemin IMAGE (celui qui compte).
 * Le /api/health historique ne teste que DB/R2/texte : c'est pourquoi la panne
 * image de juin (429 quota, 15 jours) était invisible. Cet endpoint expose
 * l'état réel du modèle de retouche pour un coup d'œil + un uptime monitor
 * externe (UptimeRobot) qui alerte même si tout le serveur tombe.
 *
 * 200 = sain · 503 = dégradé (dernier canary en échec ou ≥50 % d'échecs sur 1 h)
 */
export async function GET() {
  try {
    const snap = await getImageHealthSnapshot();
    const degraded =
      snap.lastCanaryOk === false || (snap.errorRate1h !== null && snap.errorRate1h >= 0.5);

    return NextResponse.json(
      {
        status: degraded ? "degraded" : "ok",
        ...snap,
        primaryModel: getPrimaryProvider().modelLabel(),
        hasFallback: hasResilienceFallback(),
        timestamp: new Date().toISOString(),
      },
      { status: degraded ? 503 : 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("health/image error:", err);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
