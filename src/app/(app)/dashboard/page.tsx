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
  searchParams: Promise<{ welcome?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const { welcome } = await searchParams;

  const recentJobs = await prisma.processingJob.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      _count: { select: { photos: true } },
    },
  });

  const totalPhotos = await prisma.processedPhoto.count({
    where: { job: { userId: session.user.id }, status: "COMPLETED" },
  });

  const isAdmin = session.user.role === "ADMIN";

  return (
    <div>
      {/* Onboarding banner */}
      {welcome === "true" && (
        <div className="bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-2xl p-6 mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-lg mb-1">
              Bienvenue sur Pictaura, {session.user.name?.split(" ")[0]} !
            </p>
            <p className="text-violet-100 text-sm">
              Vous avez recu <strong>{session.user.credits} credits gratuits</strong> pour tester le service. Commencez par optimiser vos photos.
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
              ? "Compte administrateur — credits illimites"
              : `${session.user.credits} credit(s) disponible(s)`}
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
        <StatCard label="Photos traitees" value={String(totalPhotos)} icon={ImageIcon} />
        <StatCard label="Credits restants" value={isAdmin ? "\u221E" : String(session.user.credits)} icon={CreditCard} />
        <StatCard label="Jobs total" value={String(recentJobs.length)} icon={FolderOpen} />
      </div>

      {/* CTA low credits */}
      {!isAdmin && session.user.credits < 3 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-300">
                Il vous reste seulement {session.user.credits} credit(s) !
              </p>
              <p className="text-sm text-amber-400/70 mt-0.5">
                Rechargez votre compte pour continuer a optimiser vos photos.
              </p>
            </div>
          </div>
          <Link
            href="/billing"
            className="bg-amber-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors whitespace-nowrap"
          >
            Acheter des credits
          </Link>
        </div>
      )}

      {/* Recent jobs */}
      <h2 className="text-lg font-semibold text-white mb-4">Traitements recents</h2>

      {recentJobs.length === 0 ? (
        <div className="bg-[var(--surface)] rounded-2xl border border-white/8 p-12 text-center">
          <ImageIcon className="w-12 h-12 text-[var(--muted)] mx-auto mb-4" />
          <p className="text-zinc-400 mb-4">Vous n'avez pas encore effectue de retouche.</p>
          <Link
            href="/immobilier"
            className="bg-gradient-to-r from-violet-600 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-violet-700 hover:to-blue-700 transition-all inline-block"
          >
            Commencer ma premiere retouche
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
                    {job.status === "COMPLETED" && (
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
