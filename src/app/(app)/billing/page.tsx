import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/config/plans";
import PricingGrid from "./PricingGrid";
import ManageSubscriptionButton from "./ManageButton";
import { X } from "lucide-react";
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
  PURCHASE:    { label: "Achat",           icon: CreditCard, color: "text-accent bg-accent/10" },
  FREE_SIGNUP: { label: "Crédits offerts", icon: Gift,       color: "text-accent bg-accent/10" },
  ADMIN_GRANT: { label: "Crédit admin",    icon: Shield,     color: "text-brand bg-brand/10" },
  USAGE:       { label: "Utilisation",     icon: ImageIcon,  color: "text-ink-muted bg-ink/5" },
  REFUND:      { label: "Remboursement",   icon: Undo2,      color: "text-brand bg-sun/20" },
  REFERRAL:    { label: "Parrainage",      icon: Users,      color: "text-brand bg-brand/10" },
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
        <div className="bg-white border border-ink/10 rounded-xl p-4 flex items-center gap-3 mb-6 shadow-sm">
          <X className="w-4 h-4 text-ink-muted flex-shrink-0" />
          <p className="text-sm text-ink-muted">Paiement annulé. Aucun montant n&apos;a été prélevé.</p>
        </div>
      )}
      <h1 className="text-3xl md:text-4xl font-display tracking-tight text-ink mb-2">Abonnement & Facturation</h1>
      <p className="text-ink-muted mb-8">
        {isAdmin
          ? "Compte administrateur — crédits illimités."
          : isSubscribed
          ? `Abonnement actif — ${session.user.credits} crédit(s) restants.`
          : `${session.user.credits} crédit(s) disponibles — choisissez un plan dès ${PLANS[0].creditsPerMonth} retouches/mois.`}
      </p>

      {!isAdmin && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white border border-ink/10 rounded-2xl p-5 text-center shadow-sm">
            <div className="text-3xl font-display text-ink">{totalUsed}</div>
            <div className="text-xs text-ink-muted mt-1 uppercase tracking-wider">Photos traitées</div>
          </div>
          <div className="bg-white border border-ink/10 rounded-2xl p-5 text-center shadow-sm">
            <div className="text-3xl font-display text-accent">{session.user.credits}</div>
            <div className="text-xs text-ink-muted mt-1 uppercase tracking-wider">Crédits restants</div>
          </div>
        </div>
      )}

      {!isAdmin && !isSubscribed && <PricingGrid />}

      {!isAdmin && isSubscribed && (
        <div className="bg-sun/15 border border-sun/40 rounded-2xl p-6 mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
            <span className="font-display text-ink">Abonnement actif</span>
          </div>
          <p className="text-sm text-ink-muted mb-3">
            Vos crédits sont renouvelés automatiquement à chaque période.
          </p>
          <ManageSubscriptionButton />
        </div>
      )}

      <h2 className="text-xl font-display tracking-tight text-ink mb-4">Historique des transactions</h2>

      {transactions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-ink/10 p-8 text-center text-ink-muted shadow-sm">
          Aucune transaction pour l&apos;instant.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-ink/10 overflow-x-auto shadow-sm">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="bg-cream-2 border-b border-ink/10">
              <tr>
                <th className="text-left px-4 md:px-5 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Date</th>
                <th className="text-left px-4 md:px-5 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Type</th>
                <th className="text-left px-4 md:px-5 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs hidden sm:table-cell">Description</th>
                <th className="text-right px-4 md:px-5 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Crédits</th>
                <th className="text-right px-4 md:px-5 py-3 font-semibold text-ink-muted uppercase tracking-wider text-xs">Solde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {transactions.map((tx) => {
                const meta = TX_META[tx.type] ?? { label: tx.type, icon: CreditCard, color: "text-ink-muted bg-ink/5" };
                const Icon = meta.icon;
                return (
                  <tr key={tx.id} className="hover:bg-cream/60 transition-colors">
                    <td className="px-4 md:px-5 py-3 text-ink-muted whitespace-nowrap text-xs">
                      {new Date(tx.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit", month: "short"
                      })}
                    </td>
                    <td className="px-4 md:px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${meta.color}`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                    </td>
                    <td className="px-4 md:px-5 py-3 text-ink-muted text-xs max-w-xs truncate hidden sm:table-cell">
                      {tx.description ?? "—"}
                    </td>
                    <td className={`px-4 md:px-5 py-3 text-right font-bold ${tx.amount > 0 ? "text-accent" : "text-ink-muted"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </td>
                    <td className="px-4 md:px-5 py-3 text-right text-ink-muted text-xs">
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
