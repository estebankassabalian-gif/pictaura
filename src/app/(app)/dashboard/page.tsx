import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PRESET_LABELS } from "@/config/plans";
import { Preset } from "@prisma/client";
import { getStatusBadgeClasses, getStatusLabel } from "@/config/agents";
import { ImageIcon, CreditCard, FolderOpen, AlertTriangle, Plus, ArrowRight } from "lucide-react";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; page?: string; payment?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const { welcome, page: pageStr, payment } = await searchParams;

  const PAGE_SIZE = 10;
  const currentPage = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const [recentJobs, totalJobs, totalPhotos] = await Promise.all([
    prisma.processingJob.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip,
      include: {
        _count: { select: { photos: true } },
      },
    }),
    prisma.processingJob.count({ where: { userId: session.user.id } }),
    prisma.processedPhoto.count({
      where: { job: { userId: session.user.id }, status: "COMPLETED" },
    }),
  ]);

  const totalPages = Math.ceil(totalJobs / PAGE_SIZE);

  const isAdmin = session.user.role === "ADMIN";

  return (
    <div>
      {/* Bannière succès paiement */}
      {payment === "success" && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl p-6 mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-lg mb-1">
              Abonnement Pro activé !
            </p>
            <p className="text-emerald-100 text-sm">
              200 crédits ont été ajoutés à votre compte. Commencez à optimiser vos photos maintenant.
            </p>
          </div>
          <Link
            href="/immobilier"
            className="bg-white/10 backdrop-blur text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-white/20 transition-colors whitespace-nowrap flex-shrink-0"
          >
            Commencer
          </Link>
        </div>
      )}

      {/* Onboarding banner */}
      {welcome === "true" && (
        <div className="bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-2xl p-6 mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-lg mb-1">
              Bienvenue sur Pictaura, {session.user.name?.split(" ")[0]} !
            </p>
            <p className="text-violet-100 text-sm">
              Vous avez reçu <strong>{session.user.credits} crédits gratuits</strong> pour tester le service. Commencez par optimiser vos photos.
            </p>
          </div>
          <Link
            href="/immobilier"
            className="bg-white/10 backdrop-blur text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-white/20 transition-colors whitespace-nowrap flex-shrink-0"
          >
            Commencer
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Bonjour {session.user.name?.split(" ")[0] ?? ""}
          </h1>
          <p className="text-zinc-400 mt-1">
            {isAdmin
              ? "Compte administrateur — crédits illimités"
              : `${session.user.credits} crédit(s) disponible(s)`}
          </p>
        </div>
        <Link
          href="/immobilier"
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:from-violet-700 hover:to-blue-700 transition-all"
        >
          <Plus className="w-4 h-4" /> Nouvelle retouche
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <StatCard label="Photos traitées" value={String(totalPhotos)} icon={ImageIcon} />
        <StatCard label="Crédits restants" value={isAdmin ? "\u221E" : String(session.user.credits)} icon={CreditCard} />
        <StatCard label="Jobs total" value={String(totalJobs)} icon={FolderOpen} />
      </div>

      {/* CTA low credits */}
      {!isAdmin && session.user.credits < 3 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-300">
                Il vous reste seulement {session.user.credits} crédit(s) !
              </p>
              <p className="text-sm text-amber-400/70 mt-0.5">
                Rechargez votre compte pour continuer à optimiser vos photos.
              </p>
            </div>
          </div>
          <Link
            href="/billing"
            className="bg-amber-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors whitespace-nowrap"
          >
            Acheter des crédits
          </Link>
        </div>
      )}

      {/* Recent jobs */}
      <h2 className="text-lg font-semibold text-white mb-4">Traitements récents</h2>

      {recentJobs.length === 0 ? (
        <div className="bg-[var(--surface)] rounded-2xl border border-white/8 p-12 text-center">
          <ImageIcon className="w-12 h-12 text-[var(--muted)] mx-auto mb-4" />
          <p className="text-zinc-400 mb-4">Vous n'avez pas encore effectué de retouche.</p>
          <Link
            href="/immobilier"
            className="bg-gradient-to-r from-violet-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-violet-700 hover:to-blue-700 transition-all inline-block"
          >
            Commencer ma première retouche
          </Link>
        </div>
      ) : (
        <div className="bg-[var(--surface)] rounded-2xl border border-white/8 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)] border-b border-white/8">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-zinc-400">Plateforme</th>
                <th className="text-left px-6 py-3 font-medium text-zinc-400">Photos</th>
                <th className="text-left px-6 py-3 font-medium text-zinc-400">Statut</th>
                <th className="text-left px-6 py-3 font-medium text-zinc-400">Date</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentJobs.map((job) => (
                <tr key={job.id} className="hover:bg-white/[0.02]">
                  <td className="px-6 py-4 font-medium text-white">
                    {PRESET_LABELS[job.preset as Preset]}
                  </td>
                  <td className="px-6 py-4 text-zinc-400">
                    {job._count.photos} photo(s)
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClasses(job.status)}`}>
                      {getStatusLabel(job.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-500">
                    {new Date(job.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {(job.status === "COMPLETED" || job.status === "PROCESSING" || job.status === "PENDING") && (
                      <Link
                        href={`/results/${job.id}`}
                        className="text-violet-400 font-medium hover:underline flex items-center gap-1 justify-end"
                      >
                        Voir <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {currentPage > 1 && (
            <Link
              href={`/dashboard?page=${currentPage - 1}`}
              className="px-3 py-1.5 text-sm border border-white/10 rounded-lg hover:border-violet-400 text-zinc-400 hover:text-violet-400 transition-colors"
            >
              Précédent
            </Link>
          )}
          <span className="text-sm text-zinc-500">
            Page {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/dashboard?page=${currentPage + 1}`}
              className="px-3 py-1.5 text-sm border border-white/10 rounded-lg hover:border-violet-400 text-zinc-400 hover:text-violet-400 transition-colors"
            >
              Suivant
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-white/8 p-6">
      <Icon className="w-6 h-6 text-violet-400 mb-3" />
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-sm text-zinc-400 mt-1">{label}</div>
    </div>
  );
}
