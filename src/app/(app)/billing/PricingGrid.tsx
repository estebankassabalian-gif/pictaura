"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import {
  PLANS,
  ONESHOT_PACK,
  formatEur,
  formatPriceDisplay,
  getPriceEurCents,
  type BillingInterval,
} from "@/config/plans";
import SubscribeButton, { PackBuyButton } from "./BuyButton";

export default function PricingGrid() {
  const [interval, setInterval] = useState<BillingInterval>("month");

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display text-ink">Choisissez votre plan</h2>
        <div className="inline-flex bg-white border border-ink-soft rounded-full p-1 shadow-sm">
          <button
            onClick={() => setInterval("month")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              interval === "month" ? "bg-ink text-cream" : "text-ink-muted"
            }`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setInterval("year")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              interval === "year" ? "bg-ink text-cream" : "text-ink-muted"
            }`}
          >
            Annuel <span className="text-accent ml-1">-20%</span>
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {PLANS.map((plan) => {
          const cents = getPriceEurCents(plan, interval);
          const annualSavings =
            interval === "year"
              ? Math.round((plan.monthlyPriceEurCents * 12 - plan.annualPriceEurCents) / 100)
              : 0;
          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border shadow-sm p-6 flex flex-col relative ${
                plan.highlighted
                  ? "border-accent ring-2 ring-accent/20"
                  : "border-ink-soft"
              }`}
              style={{ borderTop: `4px solid ${plan.accentColor}` }}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full shadow-sm">
                  Le plus choisi
                </div>
              )}
              <div className="mb-4">
                <div className="text-base font-display text-ink">{plan.name}</div>
                <div className="text-xs text-ink-muted">{plan.tagline}</div>
              </div>
              <div className="mb-1">
                <span className="text-4xl font-display text-ink">{formatEur(cents)}</span>
                <span className="text-sm text-ink-muted ml-1">
                  {interval === "year" ? "/an" : "/mois"}
                </span>
              </div>
              {interval === "year" && annualSavings > 0 && (
                <div className="text-[11px] text-accent font-semibold mb-1">
                  Économisez {annualSavings}€/an
                </div>
              )}
              <div className="text-xs font-bold mb-5" style={{ color: plan.accentColor }}>
                {plan.creditsPerMonth} retouches par mois
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-ink">
                    <Check
                      className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                      style={{ color: plan.accentColor }}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <SubscribeButton
                planId={plan.id}
                interval={interval}
                label={`S'abonner — ${formatPriceDisplay(plan, interval)}`}
              />
            </div>
          );
        })}
      </div>

      {/* ── Pack one-shot ───────────────────────────────────────── */}
      <div className="mt-8 bg-cream-2 rounded-2xl border border-ink-soft p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
        <div className="flex-1">
          <div className="text-sm font-display text-ink mb-1">
            Pas prêt à vous abonner ?
          </div>
          <div className="text-base font-display text-ink mb-1">
            {ONESHOT_PACK.name} — {formatEur(ONESHOT_PACK.priceEurCents)}
          </div>
          <div className="text-xs text-ink-muted">
            Paiement unique. Les crédits ne s'expirent pas. Testez sans engagement.
          </div>
        </div>
        <div className="w-full md:w-auto md:min-w-[200px]">
          <PackBuyButton label={`Acheter — ${formatEur(ONESHOT_PACK.priceEurCents)}`} />
        </div>
      </div>
    </div>
  );
}
