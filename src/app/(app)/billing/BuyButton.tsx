"use client";

import { useState } from "react";

export default function BuyButton({
  packId,
}: {
  packId: "starter" | "pro" | "studio";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleBuy() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Erreur lors de la création du paiement");
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
        onClick={handleBuy}
        disabled={loading}
        className="w-full bg-brand-600 text-white py-2.5 rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50"
      >
        {loading ? "Chargement..." : "Acheter →"}
      </button>
      {error && (
        <p className="text-red-400 text-xs mt-2 text-center">{error}</p>
      )}
    </div>
  );
}
