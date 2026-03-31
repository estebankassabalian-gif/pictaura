"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForceFailButton({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleForceFail() {
    if (!confirm("Forcer l'échec de ce job et rembourser les crédits non utilisés ?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/jobs/force-fail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Job stoppé. ${data.creditsRefunded} crédit(s) remboursé(s).`);
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
      onClick={handleForceFail}
      disabled={loading}
      className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
    >
      {loading ? "..." : "Force-fail"}
    </button>
  );
}
