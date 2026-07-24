import { NextResponse, type NextRequest } from "next/server";
import { sendTelegramAlert } from "@/lib/telegram";

/**
 * POST /api/unsubscribe
 * Cible de désinscription des campagnes d'emailing à froid (Pictaura Outreach).
 * Ce service n'a pas sa propre liste de contacts — la source de vérité est le
 * Google Sheet de la campagne. On se contente d'alerter l'opérateur pour qu'il
 * marque `unsubscribed = oui` sur la ligne concernée (processus documenté dans
 * pictaura-outreach/QUICKSTART_LUNDI.md).
 *
 * Déclenché uniquement sur clic explicite (POST), jamais sur le simple
 * chargement de la page GET — les scanners de sécurité email (Google/Microsoft
 * Safe Links) "cliquent" automatiquement tout lien présent dans un email pour
 * le pré-analyser, ce qui déclencherait de fausses désinscriptions si l'action
 * se faisait au chargement.
 */
export async function POST(req: NextRequest) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const cleanEmail = typeof email === "string" ? email.trim().slice(0, 254) : "";

  if (cleanEmail) {
    await sendTelegramAlert(
      `📭 Désinscription prospection — marquer unsubscribed=oui dans le Sheet "Pictaura Outreach" pour : ${cleanEmail}`
    );
  }

  return NextResponse.json({ ok: true });
}
