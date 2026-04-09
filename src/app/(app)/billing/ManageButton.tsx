"use client";

import { useState } from "react";
import { Settings } from "lucide-react";

export default function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleManage() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Erreur");
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
        onClick={handleManage}
        disabled={loading}
        className="flex items-center gap-2 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50"
      >
        <Settings className="w-4 h-4" />
        {loading ? "Redirection..." : "Gérer mon abonnement (factures, annulation)"}
      </button>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
