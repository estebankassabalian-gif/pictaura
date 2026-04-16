import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PRESET_LABELS } from "@/config/plans";
import { Preset } from "@prisma/client";
import { getStatusBadgeClasses, getStatusLabel } from "@/config/agents";
import { ImageIcon, CreditCard, FolderOpen, AlertTriangle, Plus, ArrowRight } from "lucide-react";
import VoronoiBackground from "@/components/brand/VoronoiBackground";

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
  const firstName = session.user.name?.split(" ")[0] ?? "";

  return (
    <div>
      {/* Hero salutation — bannière voronoï subtile */}
      <section className="relative overflow-hidden rounded-3xl mb-8 p-8 md:p-10 text-cream">
        <VoronoiBackground intensity="hero" />
        <div className="absolute inset-0 bg-brand/25" aria-hidden="true" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-sun font-bold mb-2">Tableau de bord</p>
            <h1 className="text-3xl md:text-4xl font-display tracking-tight leading-tight">
              Bonjour {firstName}
            </h1>
            <p className="text-cream/85 mt-2 text-sm md:text-base max-w-lg">
              {isAdmin
                ? "Compte administrateur — crédits illimités."
                : `${session.user.credits} crédit(s) disponible(s). Révélez vos prochaines photos en un clic.`}
            </p>
          </div>
          <Link
            href="/immobilier"
            className="inline-flex items-center gap-2 bg-accent text-white px-5 py-3 rounded-xl font-semibold hover:bg-accent-hover transition-colors shadow-md self-start md:self-auto"
          >
            <Plus className="w-4 h-4" /> Nouvelle retouche
          </Link>
        </div>
      </section>

      {/* Bannière succès paiement */}
      {payment === "success" && (
        <div className="bg-sun/15 border border-sun/40 text-ink rounded-2xl p-6 mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-lg mb-1">Abonnement activé</p>
            <p className="text-ink-muted text-sm">
              Vos crédits mensuels ont été ajoutés à votre compte. Commencez à optimiser vos photos.
            </p>
          </div>
          <Link
            href="/immobilier"
            className="bg-accent text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-accent-hover transition-colors whitespace-nowrap flex-shrink-0"
          >
            Commencer
          </Link>
        </div>
      )}

      {/* Onboarding welcome */}
      {welcome === "true" && (
        <div className="bg-accent/10 border border-accent/30 text-ink rounded-2xl p-6 mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-lg mb-1">
              Bienvenue sur Pictaura, {firstName} !
            </p>
            <p className="text-ink-muted text-sm">
              Vous avez reçu <strong className="text-accent">{session.user.credits} crédits gratuits</strong> pour tester le service.
            </p>
          </div>
          <Link
            href="/immobilier"
            className="bg-accent text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-accent-hover transition-colors whitespace-nowrap flex-shrink-0"
          >
            Commencer
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard label="Photos traitées" value={String(totalPhotos)} icon={ImageIcon} />
        <StatCard label="Crédits restants" value={isAdmin ? "\u221E" : String(session.user.credits)} icon={CreditCard} />
        <StatCard label="Jobs total" value={String(totalJobs)} icon={FolderOpen} />
      </div>

      {/* Alerte low credits */}
      {!isAdmin && session.user.credits < 3 && (
        <div className="bg-sun/15 border border-sun/40 rounded-xl p-5 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-accent flex-shrink-0" />
            <div>
              <p className="font-semibold text-ink">
                Il vous reste seulement {session.user.credits} crédit(s).
              </p>
              <p className="text-sm text-ink-muted mt-0.5">
                Abonnez-vous pour continuer à optimiser vos photos.
              </p>
            </div>
          </div>
          <Link
            href="/billing"
            className="bg-accent text-white px-4 py-2 rounded-lg font-semibold hover:bg-accent-hover transition-colors whitespace-nowrap"
          >
            Voir les abonnements
          </Link>
        </div>
      )}

      {/* Traitements récents */}
      <h2 className="text-xl font-display tracking-tight text-ink mb-4">Traitements récents</h2>

      {recentJobs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-ink/10 p-12 text-center shadow-sm">
          <ImageIcon className="w-12 h-12 text-ink-muted mx-auto mb-4" />
          <p className="text-ink-muted mb-4">Vous n&apos;avez pas encore effectué de retouche.</p>
          <Link
            href="/immobilier"
            className="bg-accent text-white px-6 py-3 rounded-xl font-semibold hover:bg-accent-hover transition-colors inline-block shadow-md"
          >
            Commencer ma première retouche
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-ink/10 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-cream-2 border-b border-ink/10">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Plateforme</th>
                <th className="text-left px-6 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Photos</th>
                <th className="text-left px-6 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Statut</th>
                <th className="text-left px-6 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Date</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {recentJobs.map((job) => (
                <tr key={job.id} className="hover:bg-cream/60 transition-colors">
                  <td className="px-6 py-4 font-semibold text-ink">
                    {PRESET_LABELS[job.preset as Preset]}
                  </td>
                  <td className="px-6 py-4 text-ink-muted">
                    {job._count.photos} photo(s)
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClasses(job.status)}`}>
                      {getStatusLabel(job.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-ink-muted">
                    {new Date(job.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {(job.status === "COMPLETED" || job.status === "PROCESSING" || job.status === "PENDING") && (
                      <Link
                        href={`/results/${job.id}`}
                        className="text-accent font-semibold hover:underline flex items-center gap-1 justify-end"
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
              className="px-3 py-1.5 text-sm border border-ink/15 rounded-lg hover:border-accent text-ink-muted hover:text-accent transition-colors"
            >
              Précédent
            </Link>
          )}
          <span className="text-sm text-ink-muted">
            Page {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/dashboard?page=${currentPage + 1}`}
              className="px-3 py-1.5 text-sm border border-ink/15 rounded-lg hover:border-accent text-ink-muted hover:text-accent transition-colors"
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
    <div className="bg-white rounded-2xl border border-ink/10 p-6 shadow-sm hover:shadow-md transition-shadow">
      <Icon className="w-6 h-6 text-accent mb-3" />
      <div className="text-3xl font-display tracking-tight text-ink">{value}</div>
      <div className="text-sm text-ink-muted mt-1">{label}</div>
    </div>
  );
}
