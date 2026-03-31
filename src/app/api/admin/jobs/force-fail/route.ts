import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refundCredits } from "@/services/credits";

/**
 * POST /api/admin/jobs/force-fail
 * Force le passage en FAILED d'un job bloqué (PENDING/PROCESSING).
 * Rembourse les crédits des photos non traitées.
 * Accès admin uniquement.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { jobId } = await req.json();
  if (!jobId) return NextResponse.json({ error: "jobId requis" }, { status: 400 });

  const job = await prisma.processingJob.findUnique({
    where: { id: jobId },
    include: { photos: true },
  });

  if (!job) return NextResponse.json({ error: "Job non trouvé" }, { status: 404 });
  if (job.status === "COMPLETED" || job.status === "FAILED") {
    return NextResponse.json({ error: "Job déjà terminé" }, { status: 400 });
  }

  // Compter les photos non traitées = crédits à rembourser
  const failedPhotos = job.photos.filter((p) => p.status !== "COMPLETED");
  const creditsToRefund = failedPhotos.length;

  // Passer toutes les photos en FAILED
  await prisma.processedPhoto.updateMany({
    where: { jobId, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "FAILED" },
  });

  // Passer le job en FAILED
  await prisma.processingJob.update({
    where: { id: jobId },
    data: { status: "FAILED", errorMsg: "Force-fail par admin", completedAt: new Date() },
  });

  // Rembourser si nécessaire
  if (creditsToRefund > 0) {
    await refundCredits(job.userId, creditsToRefund, jobId).catch(console.error);
  }

  return NextResponse.json({ success: true, creditsRefunded: creditsToRefund });
}
