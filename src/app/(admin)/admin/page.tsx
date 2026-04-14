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
      <h1 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
        <Shield className="w-6 h-6 text-accent-400" /> Administration
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        <AdminStat label="Utilisateurs" value={totalUsers} icon={Users} />
        <AdminStat label="Jobs total" value={totalJobs} icon={FolderOpen} />
        <AdminStat label="Photos traitées" value={totalPhotos} icon={ImageIcon} />
        <AdminStat label="Crédits vendus" value={totalCreditsSOLD} icon={CreditCard} />
      </div>

      {/* Recent users */}
      <h2 className="text-lg font-semibold text-white mb-4">Utilisateurs récents</h2>
      <div className="bg-[var(--surface)] rounded-2xl border border-white/8 overflow-hidden mb-10">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)] border-b border-white/8">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-zinc-400">Email</th>
              <th className="text-left px-5 py-3 font-medium text-zinc-400">Credits</th>
              <th className="text-left px-5 py-3 font-medium text-zinc-400">Jobs</th>
              <th className="text-left px-5 py-3 font-medium text-zinc-400">Role</th>
              <th className="text-left px-5 py-3 font-medium text-zinc-400">Date</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {recentUsers.map((user) => (
              <tr key={user.id} className="hover:bg-white/[0.02]">
                <td className="px-5 py-3">
                  <div className="font-medium text-white">{user.email}</div>
                  {user.name && (
                    <div className="text-xs text-zinc-500">{user.name}</div>
                  )}
                </td>
                <td className="px-5 py-3 text-zinc-300">{user.credits}</td>
                <td className="px-5 py-3 text-zinc-300">{user._count.jobs}</td>
                <td className="px-5 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.role === "ADMIN"
                        ? "bg-accent-500/10 text-accent-400"
                        : "bg-white/5 text-zinc-300"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-5 py-3 text-zinc-500">
                  {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-accent-400 text-xs hover:underline"
                  >
                    Gerer
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent jobs */}
      <h2 className="text-lg font-semibold text-white mb-4">Jobs récents</h2>
      <div className="bg-[var(--surface)] rounded-2xl border border-white/8 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)] border-b border-white/8">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-zinc-400">User</th>
              <th className="text-left px-5 py-3 font-medium text-zinc-400">Preset</th>
              <th className="text-left px-5 py-3 font-medium text-zinc-400">Photos</th>
              <th className="text-left px-5 py-3 font-medium text-zinc-400">Statut</th>
              <th className="text-left px-5 py-3 font-medium text-zinc-400">Date</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {recentJobs.map((job) => (
              <tr key={job.id} className="hover:bg-white/[0.02]">
                <td className="px-5 py-3 text-zinc-400">{job.user.email}</td>
                <td className="px-5 py-3 font-medium text-white">{job.preset}</td>
                <td className="px-5 py-3 text-zinc-300">{job._count.photos}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClasses(job.status)}`}>
                    {getStatusLabel(job.status)}
                  </span>
                </td>
                <td className="px-5 py-3 text-zinc-500">
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
    <div className="bg-[var(--surface)] rounded-2xl border border-white/8 p-5">
      <Icon className="w-5 h-5 text-accent-400 mb-2" />
      <div className="text-3xl font-bold text-white">{value.toLocaleString()}</div>
      <div className="text-sm text-zinc-400 mt-0.5">{label}</div>
    </div>
  );
}
