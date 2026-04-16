"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur. Réessayez.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-3xl border border-ink/10 bg-white shadow-lg p-5 md:p-8 text-center">
        <h1 className="text-2xl font-display text-ink mb-4">Lien invalide</h1>
        <p className="text-sm text-ink-muted mb-6">Ce lien de réinitialisation est invalide ou a expiré.</p>
        <Link href="/forgot-password" className="text-accent font-semibold hover:underline text-sm">
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-ink/10 bg-white shadow-lg p-5 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display tracking-tight text-ink">Nouveau mot de passe</h1>
        <p className="text-ink-muted mt-2 text-sm">Choisissez un mot de passe sûr et mémorable.</p>
      </div>

      {success ? (
        <div className="text-center">
          <div className="w-16 h-16 bg-sun/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-display text-ink mb-2">Mot de passe mis à jour</h2>
          <p className="text-sm text-ink-muted mb-6">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
          <Link
            href="/login"
            className="inline-block bg-accent text-white rounded-xl px-6 py-3 font-semibold hover:bg-accent-hover transition-colors shadow-md"
          >
            Se connecter
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-accent/10 border border-accent/30 text-accent text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">Nouveau mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              className="w-full border border-ink/15 bg-cream rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="Minimum 8 caractères"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">Confirmer</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              maxLength={128}
              autoComplete="new-password"
              className="w-full border border-ink/15 bg-cream rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="Retapez le mot de passe"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white rounded-xl py-3 font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
          </button>
        </form>
      )}
    </div>
  );
}
