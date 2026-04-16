"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FREE_SIGNUP_CREDITS } from "@/config/plans";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la création du compte");
        return;
      }

      await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      router.push("/dashboard?welcome=true");
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-ink/10 bg-white shadow-lg p-5 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display tracking-tight text-ink">Créez votre compte</h1>
        <p className="text-ink-muted mt-2 text-sm">
          <span className="text-accent font-semibold">{FREE_SIGNUP_CREDITS} crédits offerts</span> pour démarrer.
        </p>
      </div>

      <button
        onClick={() => signIn("google", { callbackUrl: "/dashboard?welcome=true" })}
        className="w-full flex items-center justify-center gap-3 border border-ink/15 bg-white rounded-xl py-3 text-sm font-semibold text-ink hover:bg-cream-2 transition-colors mb-6"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        S'inscrire avec Google
      </button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-ink/10" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wider">
          <span className="bg-white px-3 text-ink-muted">ou</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-accent/10 border border-accent/30 text-accent text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-ink mb-1.5">Nom</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            autoComplete="name"
            className="w-full border border-ink/15 bg-cream rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            placeholder="Jean Dupont"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink mb-1.5">Email</label>
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

        <div>
          <label className="block text-sm font-semibold text-ink mb-1.5">Mot de passe</label>
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

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent text-white rounded-xl py-3 font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 shadow-md"
        >
          {loading ? "Création..." : `Créer mon compte — ${FREE_SIGNUP_CREDITS} crédits offerts`}
        </button>
      </form>

      <p className="text-center text-sm text-ink-muted mt-6">
        Déjà un compte ?{" "}
        <Link href="/login" className="text-accent font-semibold hover:underline">
          Se connecter
        </Link>
      </p>

      <p className="text-center text-xs text-ink-muted/70 mt-4">
        En créant un compte, vous acceptez nos{" "}
        <Link href="/cgu" className="underline hover:text-accent">CGU</Link> et notre{" "}
        <Link href="/politique-confidentialite" className="underline hover:text-accent">
          politique de confidentialité
        </Link>.
      </p>
    </div>
  );
}
