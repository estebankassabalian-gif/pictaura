"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur. Réessayez.");
        return;
      }

      setSent(true);
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-ink/10 bg-white shadow-lg p-5 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display tracking-tight text-ink">Mot de passe oublié</h1>
        <p className="text-ink-muted mt-2 text-sm">On vous envoie un lien de réinitialisation.</p>
      </div>

      {sent ? (
        <div className="text-center">
          <div className="w-16 h-16 bg-sun/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-display text-ink mb-2">Email envoyé</h2>
          <p className="text-sm text-ink-muted mb-6">
            Si un compte existe avec cette adresse, vous recevrez un lien valable 1 heure.
          </p>
          <Link href="/login" className="text-sm text-accent font-semibold hover:underline">
            ← Retour à la connexion
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-accent/10 border border-accent/30 text-accent text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">Adresse email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
                autoComplete="email"
                className="w-full border border-ink/15 bg-cream rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder="vous@exemple.fr"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-white rounded-xl py-3 font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? "Envoi..." : "Envoyer le lien"}
            </button>
          </form>

          <p className="text-center text-sm text-ink-muted mt-6">
            <Link href="/login" className="text-accent font-semibold hover:underline">
              ← Retour à la connexion
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
