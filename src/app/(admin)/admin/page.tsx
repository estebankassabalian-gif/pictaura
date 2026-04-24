import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ForceFailButton from "./ForceFailButton";
import RegenSeoButton from "./RegenSeoButton";
import { getStatusBadgeClasses, getStatusLabel } from "@/config/agents";
import { Users, FolderOpen, ImageIcon, CreditCard, Shield, UserPlus, Sparkles, ThumbsUp, TrendingUp, Activity } from "lucide-react";
import bcrypt from "bcryptjs";
import { JobStatus, TransactionType } from "@prisma/client";
import { revalidatePath } from "next/cache";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  async function createTestAccount(formData: FormData) {
    "use server";
    const currentSession = await auth();
    if (!currentSession?.user || currentSession.user.role !== "ADMIN") return;

    const name = String(formData.get("name") ?? "").trim();
    const emailRaw = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const credits = parseInt(String(formData.get("credits") ?? "300"), 10);

    if (!name || !emailRaw || password.length < 8 || isNaN(credits) || credits < 0 || credits > 10000) return;

    const email = emailRaw.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return;

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          credits,
          isSubscribed: true,
          emailVerified: new Date(),
        },
      });
      if (credits > 0) {
        await tx.creditTransaction.create({
          data: {
            userId: newUser.id,
            type: TransactionType.ADMIN_GRANT,
            amount: credits,
            balanceAfter: credits,
            description: `Compte de test — ${credits} crédits offerts`,
          },
        });
      }
    });

    revalidatePath("/admin");
  }

  async function toggleUserSubscription(formData: FormData) {
    "use server";
    const currentSession = await auth();
    if (!currentSession?.user || currentSession.user.role !== "ADMIN") return;

    const targetId = String(formData.get("userId") ?? "");
    if (!targetId) return;

    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { isSubscribed: true } });
    if (!target) return;

    await prisma.user.update({
      where: { id: targetId },
      data: { isSubscribed: !target.isSubscribed },
    });
    revalidatePath("/admin");
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
        isSubscribed: true,
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

  // ─── Métriques business (KPIs pour piloter testeurs / prod) ───────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    seoTotalCompleted,
    seoWithMetadata,
    inpaintCompleted,
    inpaintRejected,
    inpaintAwaiting,
    creditsConsumed7d,
    jobsCreated7d,
    activeUsers7d,
  ] = await Promise.all([
    prisma.processedPhoto.count({ where: { status: JobStatus.COMPLETED } }),
    prisma.processedPhoto.count({
      where: { status: JobStatus.COMPLETED, seoFileName: { not: null } },
    }),
    prisma.inpaintingJob.count({ where: { status: JobStatus.COMPLETED } }),
    prisma.inpaintingJob.count({ where: { status: JobStatus.REJECTED } }),
    prisma.inpaintingJob.count({ where: { status: JobStatus.AWAITING_VALIDATION } }),
    prisma.creditTransaction.aggregate({
      where: { type: TransactionType.USAGE, createdAt: { gte: sevenDaysAgo } },
      _sum: { amount: true },
    }),
    prisma.processingJob.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.processingJob.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      distinct: ["userId"],
      select: { userId: true },
    }),
  ]);

  const seoSuccessRate = seoTotalCompleted > 0
    ? Math.round((seoWithMetadata / seoTotalCompleted) * 100)
    : 0;
  const inpaintTotalDecided = inpaintCompleted + inpaintRejected;
  const inpaintApproveRate = inpaintTotalDecided > 0
    ? Math.round((inpaintCompleted / inpaintTotalDecided) * 100)
    : 0;
  const creditsConsumed7dValue = Math.abs(creditsConsumed7d._sum.amount ?? 0);
  const dailyCreditsAvg = Math.round(creditsConsumed7dValue / 7);
  const activeUsersCount = activeUsers7d.length;

  return (
    <div>
      <h1 className="text-3xl md:text-4xl font-display tracking-tight text-ink mb-8 flex items-center gap-3">
        <Shield className="w-7 h-7 text-accent" /> Administration
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <AdminStat label="Utilisateurs" value={totalUsers} icon={Users} />
        <AdminStat label="Jobs total" value={totalJobs} icon={FolderOpen} />
        <AdminStat label="Photos traitées" value={totalPhotos} icon={ImageIcon} />
        <AdminStat label="Crédits vendus" value={totalCreditsSOLD} icon={CreditCard} />
      </div>

      {/* Métriques business — KPIs pour piloter les testeurs */}
      <h2 className="font-display text-xl text-ink mb-3 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-accent" /> Métriques business (7 derniers jours)
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <AdminStat
          label={`SEO injecté (${seoWithMetadata}/${seoTotalCompleted})`}
          value={`${seoSuccessRate}%`}
          icon={Sparkles}
          accent={seoSuccessRate >= 95 ? "good" : seoSuccessRate >= 80 ? "warn" : "bad"}
        />
        <AdminStat
          label={`Retouches IA acceptées (${inpaintCompleted}/${inpaintTotalDecided})${inpaintAwaiting > 0 ? ` · ${inpaintAwaiting} en attente` : ""}`}
          value={`${inpaintApproveRate}%`}
          icon={ThumbsUp}
        />
        <AdminStat
          label={`Crédits consommés (~${dailyCreditsAvg}/jour)`}
          value={creditsConsumed7dValue}
          icon={Activity}
        />
        <AdminStat
          label={`Utilisateurs actifs · ${jobsCreated7d} jobs`}
          value={activeUsersCount}
          icon={Users}
        />
      </div>

      {/* Créer un compte de test */}
      <div className="bg-white rounded-2xl border border-ink/10 shadow-sm p-6 mb-10">
        <h2 className="font-display text-xl text-ink mb-2 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-accent" /> Créer un compte de test
        </h2>
        <p className="text-sm text-ink-muted mb-4">
          Compte prêt à l'emploi : mot de passe défini, crédits crédités, watermark désactivé.
        </p>
        <form action={createTestAccount} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            name="name"
            required
            placeholder="Nom complet"
            className="border border-ink/15 rounded-lg px-3 py-2 text-sm md:col-span-1"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="email@exemple.com"
            className="border border-ink/15 rounded-lg px-3 py-2 text-sm md:col-span-2"
          />
          <input
            name="password"
            required
            minLength={8}
            placeholder="Mot de passe (min 8)"
            className="border border-ink/15 rounded-lg px-3 py-2 text-sm md:col-span-1"
          />
          <input
            name="credits"
            type="number"
            min="0"
            max="10000"
            defaultValue="300"
            className="border border-ink/15 rounded-lg px-3 py-2 text-sm md:col-span-1"
          />
          <button
            type="submit"
            className="md:col-span-5 bg-accent text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            Créer le compte
          </button>
        </form>
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
              <th className="text-left px-5 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Premium</th>
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
                <td className="px-5 py-3">
                  <form action={toggleUserSubscription} className="inline-flex items-center gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        user.isSubscribed
                          ? "bg-green-100 text-green-700"
                          : "bg-ink/5 text-ink-muted"
                      }`}
                    >
                      {user.isSubscribed ? "Premium" : "Gratuit"}
                    </span>
                    <button
                      type="submit"
                      className="text-xs font-semibold text-accent hover:underline"
                      title={user.isSubscribed ? "Remettre le watermark" : "Retirer le watermark"}
                    >
                      {user.isSubscribed ? "Désactiver" : "Activer"}
                    </button>
                  </form>
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
                  <div className="flex items-center gap-3 justify-end">
                    {(job.status === "PENDING" || job.status === "PROCESSING") && (
                      <ForceFailButton jobId={job.id} />
                    )}
                    {job.status === "COMPLETED" && <RegenSeoButton jobId={job.id} />}
                  </div>
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
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "good" | "warn" | "bad";
}) {
  const accentClass =
    accent === "good" ? "text-green-700"
    : accent === "warn" ? "text-amber-600"
    : accent === "bad" ? "text-red-600"
    : "text-ink";
  const formatted = typeof value === "number" ? value.toLocaleString() : value;
  return (
    <div className="bg-white rounded-2xl border border-ink/10 shadow-sm p-5 hover:shadow-md transition-shadow">
      <Icon className="w-5 h-5 text-accent mb-2" />
      <div className={`text-3xl font-display tracking-tight ${accentClass}`}>{formatted}</div>
      <div className="text-sm text-ink-muted mt-0.5">{label}</div>
    </div>
  );
}
