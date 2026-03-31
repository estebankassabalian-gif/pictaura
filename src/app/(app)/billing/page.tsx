import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CREDIT_PACKS, SUBSCRIPTION_PLANS } from "@/config/plans";
import BuyButton from "./BuyButton";
import { Check } from "lucide-react";
import {
  CreditCard,
  Gift,
  Shield,
  ImageIcon,
  Undo2,
  Users,
  Lightbulb,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TX_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  PURCHASE:    { label: "Achat",           icon: CreditCard, color: "text-emerald-400 bg-emerald-500/10" },
  FREE_SIGNUP: { label: "Credits offerts", icon: Gift,       color: "text-violet-400 bg-violet-500/10" },
  ADMIN_GRANT: { label: "Credit admin",    icon: Shield,     color: "text-violet-400 bg-violet-500/10" },
  USAGE:       { label: "Utilisation",     icon: ImageIcon,  color: "text-zinc-400 bg-white/5" },
  REFUND:      { label: "Remboursement",   icon: Undo2,      color: "text-amber-400 bg-amber-500/10" },
  REFERRAL:    { label: "Parrainage",      icon: Users,      color: "text-teal-400 bg-teal-500/10" },
};

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const transactions = await prisma.creditTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const isAdmin = session.user.role === "ADMIN";

  const totalPurchased = transactions.filter(t => t.amount > 0 && t.type !== "USAGE").reduce((s, t) => s + t.amount, 0);
  const totalUsed = transactions.filter(t => t.type === "USAGE").reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-2">Credits & Facturation</h1>
      <p className="text-zinc-400 mb-8">
        {isAdmin ? "Compte administrateur — credits illimites" : `Solde actuel : ${session.user.credits} credit(s)`}
      </p>

      {/* Summary */}
      {!isAdmin && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-[var(--surface)] border border-white/8 rounded-2xl p-5 text-center">
            <div className="text-2xl font-bold text-emerald-400">+{totalPurchased}</div>
            <div className="text-xs text-zinc-500 mt-1">Credits achetes</div>
          </div>
          <div className="bg-[var(--surface)] border border-white/8 rounded-2xl p-5 text-center">
            <div className="text-2xl font-bold text-zinc-300">{totalUsed}</div>
            <div className="text-xs text-zinc-500 mt-1">Photos traitees</div>
          </div>
          <div className="bg-[var(--surface)] border border-white/8 rounded-2xl p-5 text-center">
            <div className="text-2xl font-bold text-violet-400">{session.user.credits}</div>
            <div className="text-xs text-zinc-500 mt-1">Solde restant</div>
          </div>
        </div>
      )}

      {/* Packs */}
      {!isAdmin && (
        <>
          <h2 className="text-lg font-semibold text-white mb-4">Acheter des credits</h2>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className={`bg-[var(--surface)] rounded-2xl border-2 p-6 text-center relative ${
                  pack.popular ? "border-violet-500 shadow-lg shadow-violet-500/10" : "border-white/8"
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    POPULAIRE
                  </div>
                )}
                <div className="text-3xl font-bold text-white mb-1">{pack.priceDisplay}</div>
                <div className="text-violet-400 font-semibold text-xl mb-1">{pack.credits} credits</div>
                <div className="text-sm text-zinc-500 mb-5">{pack.pricePerPhoto}</div>
                <BuyButton packId={pack.id} />
              </div>
            ))}
          </div>
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 mb-10 text-sm text-violet-300 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 flex-shrink-0" />
            Packs à l&apos;unité — sans engagement. Les crédits n&apos;expirent jamais.
          </div>

          {/* Abonnements mensuels */}
          <h2 className="text-lg font-semibold text-white mb-1">Abonnements mensuels</h2>
          <p className="text-sm text-zinc-400 mb-5">Sans watermark · Renouvellement automatique · Facture TVA incluse · Résiliable à tout moment</p>
          <div className="grid md:grid-cols-3 gap-4 mb-10">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`bg-[var(--surface)] rounded-2xl border-2 p-6 relative flex flex-col ${
                  plan.popular ? "border-violet-500 shadow-lg shadow-violet-500/10" : "border-white/8"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    RECOMMANDÉ
                  </div>
                )}
                <div className="text-base font-bold text-white mb-1">{plan.name}</div>
                <div className="text-3xl font-bold text-white mb-1">{plan.priceDisplay}</div>
                <div className="text-violet-400 font-semibold text-sm mb-1">{plan.creditsPerMonth} photos/mois</div>
                <div className="text-xs text-zinc-500 mb-5">{plan.pricePerPhoto}</div>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  disabled
                  className="w-full py-2.5 rounded-xl border border-violet-500/40 text-violet-400 text-sm font-semibold opacity-60 cursor-not-allowed"
                  title="Bientôt disponible"
                >
                  Bientôt disponible
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Transaction history */}
      <h2 className="text-lg font-semibold text-white mb-4">Historique des transactions</h2>

      {transactions.length === 0 ? (
        <div className="bg-[var(--surface)] rounded-2xl border border-white/8 p-8 text-center text-zinc-500">
          Aucune transaction pour l'instant.
        </div>
      ) : (
        <div className="bg-[var(--surface)] rounded-2xl border border-white/8 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)] border-b border-white/8">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-zinc-400">Date</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-400">Type</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-400">Description</th>
                <th className="text-right px-5 py-3 font-medium text-zinc-400">Credits</th>
                <th className="text-right px-5 py-3 font-medium text-zinc-400">Solde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map((tx) => {
                const meta = TX_META[tx.type] ?? { label: tx.type, icon: CreditCard, color: "text-zinc-400 bg-white/5" };
                const Icon = meta.icon;
                return (
                  <tr key={tx.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-zinc-500 whitespace-nowrap text-xs">
                      {new Date(tx.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit", month: "short", year: "numeric"
                      })}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-400 text-xs max-w-xs truncate">
                      {tx.description ?? "—"}
                    </td>
                    <td className={`px-5 py-3 text-right font-semibold ${tx.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-500 text-xs">
                      {tx.balanceAfter}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
