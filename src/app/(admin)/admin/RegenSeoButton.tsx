"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegenSeoButton({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRegen() {
    if (!confirm("Régénérer le SEO de toutes les photos de ce job ? (consomme des appels Gemini)")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}/regen-seo`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        alert(`SEO régénéré : ${data.regenerated}/${data.total} photos. ${data.failed} échec(s).`);
        router.refresh();
      } else {
        alert(data.error ?? "Erreur");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRegen}
      disabled={loading}
      className="text-xs text-accent hover:text-accent-hover font-semibold disabled:opacity-50"
    >
      {loading ? "Régen..." : "Régen SEO"}
    </button>
  );
}
