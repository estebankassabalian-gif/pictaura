import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { retryFailedPhoto } from "@/services/processing/retry";
import { enqueueProcessJob } from "@/services/processing/queue";
import { processJob } from "@/services/processing/pipeline";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/jobs/[jobId]/photos/[photoId]/retry — relance UNE photo en échec.
 *
 * Avant cette route, une photo refusée (filtre de contenu du moteur, 8 cas le
 * 2026-09-16) laissait le client face à « Échec du traitement » sans recours :
 * il devait refaire un lot complet. Crédits : cf. retryFailedPhoto().
 */
const REFUSALS: Record<string, { status: number; error: string }> = {
  not_found: { status: 404, error: "Photo introuvable" },
  not_failed: { status: 409, error: "Cette photo n'est pas en échec" },
  job_running: {
    status: 409,
    error: "Le lot est encore en cours de traitement. Relancez cette photo une fois le lot terminé.",
  },
  not_retryable: {
    status: 422,
    error: "Cette photo ne peut pas être relancée telle quelle. Relancez le lot avec une autre consigne.",
  },
  insufficient_credits: {
    status: 402,
    error: "Crédits insuffisants pour relancer cette photo.",
  },
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string; photoId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Chaque relance coûte un appel au moteur : borne anti-martelage par compte.
  if (!checkRateLimit(`retry:${session.user.id}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Trop de relances rapprochées. Réessayez dans quelques minutes." },
      { status: 429 }
    );
  }

  const { jobId, photoId } = await params;

  let result;
  try {
    result = await retryFailedPhoto(jobId, photoId, session.user.id, session.user.role === Role.ADMIN);
  } catch {
    return NextResponse.json({ error: "Relance impossible pour le moment" }, { status: 500 });
  }

  if (!result.ok) {
    const refusal = REFUSALS[result.reason];
    return NextResponse.json({ error: refusal.error }, { status: refusal.status });
  }

  // Lot repassé PENDING : il doit être lancé. La file durable est la voie
  // normale ; si elle refuse le message (doublon "stately") ou est
  // indisponible, lancement direct — le claim atomique PENDING→PROCESSING de
  // processJob() empêche tout double traitement.
  let queued = false;
  try {
    queued = await enqueueProcessJob(jobId);
  } catch (err) {
    console.error(`Relance : file indisponible pour le job ${jobId}, lancement direct`, err);
  }
  if (!queued) {
    processJob(jobId).catch((err) => console.error(`Relance : job ${jobId} en erreur`, err));
  }

  return NextResponse.json({ ok: true, charged: result.charged });
}
