"use client";

import { useState } from "react";
import { PRO_PLAN } from "@/config/plans";

export default function SubscribeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubscribe() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Erreur lors de la création du paiement");
      }
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="w-full bg-gradient-to-r from-brand-600 to-accent-500 text-white py-3 rounded-xl font-semibold hover:from-brand-700 hover:to-accent-600 transition-all disabled:opacity-50 text-base"
      >
        {loading ? "Redirection..." : `S'abonner — ${PRO_PLAN.priceDisplay}`}
      </button>
      {error && (
        <p className="text-red-400 text-xs mt-2 text-center">{error}</p>
      )}
    </div>
  );
}
