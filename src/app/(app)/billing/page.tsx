import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PRO_PLAN } from "@/config/plans";
import SubscribeButton from "./BuyButton";
import ManageSubscriptionButton from "./ManageButton";
import { Check, X } from "lucide-react";
import {
  CreditCard,
  Gift,
  Shield,
  ImageIcon,
  Undo2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TX_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  PURCHASE:    { label: "Achat",           icon: CreditCard, color: "text-emerald-400 bg-emerald-500/10" },
  FREE_SIGNUP: { label: "Crédits offerts", icon: Gift,       color: "text-violet-400 bg-violet-500/10" },
  ADMIN_GRANT: { label: "Crédit admin",    icon: Shield,     color: "text-violet-400 bg-violet-500/10" },
  USAGE:       { label: "Utilisation",     icon: ImageIcon,  color: "text-zinc-400 bg-white/5" },
  REFUND:      { label: "Remboursement",   icon: Undo2,      color: "text-amber-400 bg-amber-500/10" },
  REFERRAL:    { label: "Parrainage",      icon: Users,      color: "text-teal-400 bg-teal-500/10" },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const { payment } = await searchParams;

  let transactions: Awaited<ReturnType<typeof prisma.creditTransaction.findMany>> = [];
  try {
    transactions = await prisma.creditTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } catch (err) {
    console.error("Billing: failed to fetch transactions", err);
  }

  const isAdmin = session.user.role === "ADMIN";
  const isSubscribed = (session.user as { isSubscribed?: boolean }).isSubscribed ?? false;

  const totalUsed = transactions.filter(t => t.type === "USAGE").reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="max-w-3xl">
      {payment === "cancelled" && (
        <div className="bg-zinc-800 border border-white/10 rounded-xl p-4 flex items-center gap-3 mb-6">
          <X className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          <p className="text-sm text-zinc-400">Paiement annulé. Aucun montant n'a été prélevé.</p>
        </div>
      )}
      <h1 className="text-2xl font-bold text-white mb-2">Abonnement & Facturation</h1>
      <p className="text-zinc-400 mb-8">
        {isAdmin
          ? "Compte administrateur — crédits illimités"
          : isSubscribed
          ? `Abonnement Pro actif — ${session.user.credits} crédit(s) restants`
          : `${session.user.credits} crédit(s) disponibles — passez au Pro pour 200 photos/mois`}
      </p>

      {/* Summary */}
      {!isAdmin && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-[var(--surface)] border border-white/8 rounded-2xl p-5 text-center">
            <div className="text-2xl font-bold text-zinc-300">{totalUsed}</div>
            <div className="text-xs text-zinc-500 mt-1">Photos traitées</div>
          </div>
          <div className="bg-[var(--surface)] border border-white/8 rounded-2xl p-5 text-center">
            <div className="text-2xl font-bold text-violet-400">{session.user.credits}</div>
            <div className="text-xs text-zinc-500 mt-1">Crédits restants</div>
          </div>
        </div>
      )}

      {/* Plan Pro */}
      {!isAdmin && !isSubscribed && (
        <div className="mb-10">
          <div className="bg-[var(--surface)] rounded-2xl border-2 border-violet-500 shadow-lg shadow-violet-500/10 p-8 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
              RECOMMANDÉ
            </div>

            <div className="text-center mb-6">
              <div className="text-base font-bold text-white mb-1">{PRO_PLAN.name}</div>
              <div className="text-4xl font-black text-white mb-1">{PRO_PLAN.priceDisplay}</div>
              <div className="text-violet-400 font-semibold text-sm">{PRO_PLAN.creditsPerMonth} photos/mois · {PRO_PLAN.pricePerPhoto}/photo</div>
            </div>

            <ul className="space-y-3 mb-8 max-w-sm mx-auto">
              {PRO_PLAN.features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-zinc-300">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="max-w-xs mx-auto">
              <SubscribeButton />
            </div>
          </div>
        </div>
      )}

      {/* Abonnement actif */}
      {!isAdmin && isSubscribed && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-emerald-400">Abonnement Pro actif</span>
          </div>
          <p className="text-sm text-zinc-400 mb-3">
            {PRO_PLAN.creditsPerMonth} crédits renouvelés chaque mois automatiquement.
          </p>
          <ManageSubscriptionButton />
        </div>
      )}

      {/* Transaction history */}
      <h2 className="text-lg font-semibold text-white mb-4">Historique des transactions</h2>

      {transactions.length === 0 ? (
        <div className="bg-[var(--surface)] rounded-2xl border border-white/8 p-8 text-center text-zinc-500">
          Aucune transaction pour l&apos;instant.
        </div>
      ) : (
        <div className="bg-[var(--surface)] rounded-2xl border border-white/8 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-2)] border-b border-white/8">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-zinc-400">Date</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-400">Type</th>
                <th className="text-left px-5 py-3 font-medium text-zinc-400">Description</th>
                <th className="text-right px-5 py-3 font-medium text-zinc-400">Crédits</th>
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
