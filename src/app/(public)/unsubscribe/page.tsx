"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, MailX } from "lucide-react";

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <UnsubscribeForm />
    </Suspense>
  );
}

function UnsubscribeForm() {
  const email = useSearchParams().get("email") ?? "";
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  async function handleUnsubscribe() {
    setStatus("loading");
    try {
      await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      /* on affiche la confirmation même en cas d'erreur réseau — l'utilisateur
         ne doit jamais rester bloqué sur un opt-out qui semble avoir échoué */
    }
    setStatus("done");
  }

  return (
    <div className="min-h-screen bg-cream text-ink">
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <Link href="/" className="text-accent text-sm font-semibold hover:underline mb-8 inline-block">
          ← Retour à l'accueil
        </Link>

        <div className="bg-white border border-ink/10 rounded-2xl p-8 shadow-sm">
          {status === "done" ? (
            <>
              <CheckCircle2 className="w-10 h-10 text-accent mx-auto mb-4" />
              <h1 className="text-2xl font-display tracking-tight text-ink mb-2">Désinscription enregistrée</h1>
              <p className="text-ink-muted text-sm">
                {email ? <>Vous ne recevrez plus d'emails de prospection à l'adresse <strong>{email}</strong>.</> : "Vous ne recevrez plus d'emails de prospection."}
              </p>
            </>
          ) : (
            <>
              <MailX className="w-10 h-10 text-accent mx-auto mb-4" />
              <h1 className="text-2xl font-display tracking-tight text-ink mb-2">Se désinscrire</h1>
              <p className="text-ink-muted text-sm mb-6">
                {email ? <>Confirmez la désinscription de <strong>{email}</strong> des emails de prospection Pictaura.</> : "Confirmez la désinscription des emails de prospection Pictaura."}
              </p>
              <button
                onClick={handleUnsubscribe}
                disabled={status === "loading"}
                className="bg-accent text-white px-6 py-3 rounded-xl font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 shadow-md"
              >
                {status === "loading" ? "..." : "Confirmer la désinscription"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
