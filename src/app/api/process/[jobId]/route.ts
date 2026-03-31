import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processJob } from "@/services/processing/pipeline";

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

  if (job.status !== "PENDING") {
    return NextResponse.json(
      { error: "Ce job est déjà en cours ou terminé" },
      { status: 409 }
    );
  }

  // Lancer le traitement de façon asynchrone (non bloquant)
  // Note MVP: processJob est synchrone et peut prendre 30-60s/photo
  // Phase 3: migrer vers BullMQ pour jobs vraiment asynchrones
  processJob(jobId).catch((error) => {
    console.error(`Job ${jobId} failed:`, error);
  });

  return NextResponse.json({ message: "Traitement lancé", jobId }, { status: 202 });
}
