import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ForceFailButton from "./ForceFailButton";
import { getStatusBadgeClasses, getStatusLabel } from "@/config/agents";
import { Users, FolderOpen, ImageIcon, CreditCard, Shield } from "lucide-react";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [
    totalUsers,
    totalJobs,
    totalPhotos,
    recentUsers,
    recentJobs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.processingJob.count(),
    prisma.processedPhoto.count({ where: { status: "COMPLETED" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        email: true,
        name: true,
        credits: true,
        role: true,
        createdAt: true,
        _count: { select: { jobs: true } },
      },
    }),
    prisma.processingJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { email: true } },
        _count: { select: { photos: true } },
      },
    }),
  ]);

  const revenueData = await prisma.creditTransaction.aggregate({
    where: { type: "PURCHASE" },
    _sum: { amount: true },
  });
  const totalCreditsSOLD = revenueData._sum.amount ?? 0;

  return (
    <div>
      <h1 className="text-3xl md:text-4xl font-display tracking-tight text-ink mb-8 flex items-center gap-3">
        <Shield className="w-7 h-7 text-accent" /> Administration
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <AdminStat label="Utilisateurs" value={totalUsers} icon={Users} />
        <AdminStat label="Jobs total" value={totalJobs} icon={FolderOpen} />
        <AdminStat label="Photos traitées" value={totalPhotos} icon={ImageIcon} />
        <AdminStat label="Crédits vendus" value={totalCreditsSOLD} icon={CreditCard} />
      </div>

      {/* Recent users */}
      <h2 className="font-display text-xl text-ink mb-4">Utilisateurs récents</h2>
      <div className="bg-white rounded-2xl border border-ink/10 shadow-sm overflow-hidden mb-10">
        <table className="w-full text-sm">
          <thead className="bg-cream-2 border-b border-ink/10">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Email</th>
              <th className="text-left px-5 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Crédits</th>
              <th className="text-left px-5 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Jobs</th>
              <th className="text-left px-5 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Rôle</th>
              <th className="text-left px-5 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Date</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {recentUsers.map((user) => (
              <tr key={user.id} className="hover:bg-cream/60 transition-colors">
                <td className="px-5 py-3">
                  <div className="font-semibold text-ink">{user.email}</div>
                  {user.name && (
                    <div className="text-xs text-ink-muted">{user.name}</div>
                  )}
                </td>
                <td className="px-5 py-3 text-ink">{user.credits}</td>
                <td className="px-5 py-3 text-ink">{user._count.jobs}</td>
                <td className="px-5 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      user.role === "ADMIN"
                        ? "bg-accent/10 text-accent"
                        : "bg-brand/10 text-brand"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-5 py-3 text-ink-muted">
                  {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-accent text-xs font-semibold hover:text-accent-hover hover:underline"
                  >
                    Gérer
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent jobs */}
      <h2 className="font-display text-xl text-ink mb-4">Jobs récents</h2>
      <div className="bg-white rounded-2xl border border-ink/10 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-2 border-b border-ink/10">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Utilisateur</th>
              <th className="text-left px-5 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Preset</th>
              <th className="text-left px-5 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Photos</th>
              <th className="text-left px-5 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Statut</th>
              <th className="text-left px-5 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Date</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {recentJobs.map((job) => (
              <tr key={job.id} className="hover:bg-cream/60 transition-colors">
                <td className="px-5 py-3 text-ink-muted">{job.user.email}</td>
                <td className="px-5 py-3 font-semibold text-ink">{job.preset}</td>
                <td className="px-5 py-3 text-ink">{job._count.photos}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClasses(job.status)}`}>
                    {getStatusLabel(job.status)}
                  </span>
                </td>
                <td className="px-5 py-3 text-ink-muted">
                  {new Date(job.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-5 py-3 text-right">
                  {(job.status === "PENDING" || job.status === "PROCESSING") && (
                    <ForceFailButton jobId={job.id} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-white rounded-2xl border border-ink/10 shadow-sm p-5 hover:shadow-md transition-shadow">
      <Icon className="w-5 h-5 text-accent mb-2" />
      <div className="text-3xl font-display tracking-tight text-ink">{value.toLocaleString()}</div>
      <div className="text-sm text-ink-muted mt-0.5">{label}</div>
    </div>
  );
}
