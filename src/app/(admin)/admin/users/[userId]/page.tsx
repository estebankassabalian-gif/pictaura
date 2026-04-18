import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminGrantCredits } from "@/services/credits";
import { revalidatePath } from "next/cache";

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      transactions: { orderBy: { createdAt: "desc" }, take: 20 },
      jobs: { orderBy: { createdAt: "desc" }, take: 10, include: { _count: { select: { photos: true } } } },
    },
  });

  if (!user) redirect("/admin");

  async function grantCredits(formData: FormData) {
    "use server";
    const amount = parseInt(String(formData.get("amount")), 10);
    if (isNaN(amount) || amount <= 0 || amount > 10000) return;

    const currentSession = await auth();
    if (!currentSession?.user?.id) return;

    await adminGrantCredits(userId, amount, currentSession.user.id);
    revalidatePath(`/admin/users/${userId}`);
  }

  async function toggleSubscription() {
    "use server";
    const currentSession = await auth();
    if (!currentSession?.user || currentSession.user.role !== "ADMIN") return;

    const target = await prisma.user.findUnique({ where: { id: userId }, select: { isSubscribed: true } });
    if (!target) return;

    await prisma.user.update({
      where: { id: userId },
      data: { isSubscribed: !target.isSubscribed },
    });
    revalidatePath(`/admin/users/${userId}`);
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
        <a href="/admin" className="hover:text-brand-600">Admin</a>
        <span>/</span>
        <span>{user.email}</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">{user.name ?? user.email}</h1>

      {/* ── Infos ────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-white/8 p-6 mb-6 grid grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-zinc-500">Email</p>
          <p className="font-medium">{user.email}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-500">Crédits</p>
          <p className="font-bold text-2xl text-brand-600">{user.credits}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-500">Rôle</p>
          <p className="font-medium">{user.role}</p>
        </div>
        <div>
          <p className="text-sm text-zinc-500">Watermark</p>
          <p className="font-medium">{user.isSubscribed ? "Retiré" : "Actif"}</p>
        </div>
      </div>

      {/* ── Watermark toggle ─────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-white/8 p-6 mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-white mb-1">Statut abonnement / watermark</h2>
          <p className="text-sm text-zinc-400">
            {user.isSubscribed
              ? "Compte premium — aucune photo n'est watermarkée."
              : "Compte gratuit — les photos au-delà des crédits offerts sont watermarkées."}
          </p>
        </div>
        <form action={toggleSubscription}>
          <button
            type="submit"
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              user.isSubscribed
                ? "bg-white/10 text-white hover:bg-white/15"
                : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            {user.isSubscribed ? "Remettre le watermark" : "Retirer le watermark"}
          </button>
        </form>
      </div>

      {/* ── Grant credits ────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-white/8 p-6 mb-6">
        <h2 className="font-semibold text-white mb-4">Ajouter des crédits</h2>
        <form action={grantCredits} className="flex gap-3">
          <input
            name="amount"
            type="number"
            min="1"
            max="10000"
            defaultValue="20"
            className="border border-white/10 rounded-lg px-3 py-2 text-sm w-32"
          />
          <button
            type="submit"
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700"
          >
            Ajouter
          </button>
        </form>
      </div>

      {/* ── Transactions ─────────────────────────────────── */}
      <h2 className="text-lg font-semibold mb-4">Transactions</h2>
      <div className="bg-surface rounded-2xl border border-white/8 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0a0a0a] border-b border-white/8">
            <tr>
              <th className="text-left px-5 py-3 font-medium text-zinc-400">Date</th>
              <th className="text-left px-5 py-3 font-medium text-zinc-400">Type</th>
              <th className="text-right px-5 py-3 font-medium text-zinc-400">Montant</th>
              <th className="text-right px-5 py-3 font-medium text-zinc-400">Solde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {user.transactions.map((tx) => (
              <tr key={tx.id}>
                <td className="px-5 py-3 text-zinc-500">
                  {new Date(tx.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-5 py-3 text-zinc-300">{tx.description ?? tx.type}</td>
                <td className={`px-5 py-3 text-right font-semibold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                  {tx.amount > 0 ? "+" : ""}{tx.amount}
                </td>
                <td className="px-5 py-3 text-right text-zinc-400">{tx.balanceAfter}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
