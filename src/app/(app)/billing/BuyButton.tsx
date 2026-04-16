"use client";

import { useState } from "react";
import type { PlanId } from "@/config/plans";

interface Props {
  planId?: PlanId;
  label?: string;
  variant?: "primary" | "secondary";
}

export default function SubscribeButton({
  planId = "immobilier",
  label,
  variant = "primary",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubscribe() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
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

  const classes =
    variant === "primary"
      ? "w-full bg-accent text-white py-3 rounded-xl font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 text-base shadow-md"
      : "w-full bg-ink text-cream py-3 rounded-xl font-semibold hover:bg-brand transition-colors disabled:opacity-50 text-sm";

  return (
    <div>
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className={classes}
      >
        {loading ? "Redirection..." : label ?? "S'abonner"}
      </button>
      {error && <p className="text-accent text-xs mt-2 text-center">{error}</p>}
    </div>
  );
}
