import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enqueueProcessJob } from "@/services/processing/queue";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { jobId } = await params;

  // Vérifier que le job appartient à l'utilisateur
  const job = await prisma.processingJob.findFirst({
    where: { id: jobId, userId: session.user.id },
  });

  if (!job) {
    return NextResponse.json({ error: "Job non trouvé" }, { status: 404 });
  }

  // Le pipeline démarre normalement dès la 1ère photo uploadée (eager start
  // dans photos/route.ts) — cet appel de fin d'upload est un filet de sécurité.
  // PROCESSING = déjà lancé → succès idempotent, pas une erreur.
  if (job.status === "PROCESSING") {
    return NextResponse.json({ message: "Traitement déjà en cours", jobId }, { status: 202 });
  }
  if (job.status !== "PENDING") {
    return NextResponse.json(
      { error: "Ce job est déjà terminé" },
      { status: 409 }
    );
  }

  // Publie la demande de traitement dans la file persistante (pg-boss) au
  // lieu d'un fire-and-forget en mémoire : le message survit même si le
  // container meurt juste après cette requête. Le pipeline se charge lui-même
  // de marquer le job FAILED + rembourser en cas d'erreur (pipeline.ts) ;
  // job-recovery.ts couvre le cas d'un worker mort en plein traitement.
  try {
    await enqueueProcessJob(jobId);
  } catch (error) {
    console.error(`Échec de la mise en file du job ${jobId}:`, error);
    return NextResponse.json({ error: "Erreur lors du lancement du traitement" }, { status: 500 });
  }

  return NextResponse.json({ message: "Traitement lancé", jobId }, { status: 202 });
}
