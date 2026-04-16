"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useToast } from "@/components/ui/Toaster";

export default function AccountPage() {
  const { data: session, update } = useSession();
  const { toast } = useToast();

  const [name, setName] = useState(session?.user?.name ?? "");
  const [nameLoading, setNameLoading] = useState(false);

  async function handleUpdateName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setNameLoading(true);
    try {
      const res = await fetch("/api/account/update-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? "Erreur", "error"); return; }
      await update({ name: name.trim() });
      toast("Nom mis à jour !", "success");
    } catch {
      toast("Erreur réseau", "error");
    } finally {
      setNameLoading(false);
    }
  }

  const [businessCity, setBusinessCity] = useState("");
  const [cityLoading, setCityLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/update-business-city")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.businessCity != null) setBusinessCity(String(d.businessCity));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUpdateCity(e: React.FormEvent) {
    e.preventDefault();
    setCityLoading(true);
    try {
      const res = await fetch("/api/account/update-business-city", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessCity: businessCity.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Erreur", "error");
        return;
      }
      toast("Zone SEO mise à jour !", "success");
    } catch {
      toast("Erreur réseau", "error");
    } finally {
      setCityLoading(false);
    }
  }

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd !== confirmPwd) { toast("Les mots de passe ne correspondent pas", "error"); return; }
    if (newPwd.length < 8) { toast("Minimum 8 caractères", "error"); return; }
    setPwdLoading(true);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? "Erreur", "error"); return; }
      toast("Mot de passe changé !", "success");
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch {
      toast("Erreur réseau", "error");
    } finally {
      setPwdLoading(false);
    }
  }

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePwd, setDeletePwd] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteForm, setShowDeleteForm] = useState(false);

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (deleteConfirm !== "SUPPRIMER") {
      toast("Tapez SUPPRIMER pour confirmer", "error"); return;
    }
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePwd }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error ?? "Erreur", "error"); return; }
      await signOut({ callbackUrl: "/" });
    } catch {
      toast("Erreur réseau", "error");
    } finally {
      setDeleteLoading(false);
    }
  }

  const inputClass = "w-full border border-ink/15 bg-cream rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent";

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl md:text-4xl font-display tracking-tight text-ink mb-8">Mon compte</h1>

      {/* Infos compte */}
      <div className="bg-white rounded-2xl border border-ink/10 p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-accent/15 border border-accent/30 rounded-full flex items-center justify-center text-2xl font-display text-accent">
            {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div>
            <p className="font-display text-ink">{session?.user?.name ?? "Utilisateur"}</p>
            <p className="text-sm text-ink-muted">{session?.user?.email}</p>
            <span className="inline-block mt-1 text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full font-semibold">
              {session?.user?.role === "ADMIN" ? "Administrateur" : "Utilisateur"}
            </span>
          </div>
        </div>

        <form onSubmit={handleUpdateName} className="space-y-3">
          <label className="block text-sm font-semibold text-ink">Nom affiché</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
              className={inputClass + " flex-1"}
              placeholder="Votre nom"
            />
            <button
              type="submit"
              disabled={nameLoading}
              className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-sm"
            >
              {nameLoading ? "..." : "Sauvegarder"}
            </button>
          </div>
        </form>
      </div>

      {/* Zone SEO (immobilier) */}
      <div className="bg-white rounded-2xl border border-ink/10 p-6 mb-6 shadow-sm">
        <h2 className="font-display text-ink text-lg mb-1">Zone SEO par défaut</h2>
        <p className="text-xs text-ink-muted mb-4">
          Utilisée pour enrichir automatiquement les métadonnées SEO de vos photos
          (ville, code postal ou quartier). Exemple : <span className="font-mono">Paris 11</span>,
          <span className="font-mono"> Nice Côte d&apos;Azur</span>, <span className="font-mono">Var 83</span>.
          Laisse vide si tu ne veux pas de géolocalisation dans le JSON-LD.
        </p>
        <form onSubmit={handleUpdateCity} className="space-y-3">
          <label className="block text-sm font-semibold text-ink">Ville / zone</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={businessCity}
              onChange={(e) => setBusinessCity(e.target.value)}
              maxLength={120}
              className={inputClass + " flex-1"}
              placeholder="Ex : Nice, Paris 11, Var 83…"
            />
            <button
              type="submit"
              disabled={cityLoading}
              className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-sm"
            >
              {cityLoading ? "..." : "Sauvegarder"}
            </button>
          </div>
        </form>
      </div>

      {/* Mot de passe */}
      <div className="bg-white rounded-2xl border border-ink/10 p-6 mb-6 shadow-sm">
        <h2 className="font-display text-ink text-lg mb-4">Changer le mot de passe</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">Mot de passe actuel</label>
            <input
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              required
              maxLength={128}
              autoComplete="current-password"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">Nouveau mot de passe</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              className={inputClass}
              placeholder="Minimum 8 caractères"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-1.5">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              required
              maxLength={128}
              autoComplete="new-password"
              className={`w-full border rounded-lg px-3 py-2 text-sm text-ink bg-cream focus:outline-none focus:ring-2 focus:ring-accent ${
                confirmPwd && confirmPwd !== newPwd ? "border-accent/60" : "border-ink/15"
              }`}
            />
            {confirmPwd && confirmPwd !== newPwd && (
              <p className="text-xs text-accent mt-1">Les mots de passe ne correspondent pas</p>
            )}
          </div>
          <button
            type="submit"
            disabled={pwdLoading || (!!confirmPwd && confirmPwd !== newPwd)}
            className="w-full bg-accent text-white py-2.5 rounded-xl font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-md"
          >
            {pwdLoading ? "Changement en cours..." : "Changer le mot de passe"}
          </button>
        </form>
      </div>

      {/* Zone de danger */}
      <div className="bg-white rounded-2xl border border-accent/25 p-6 shadow-sm">
        <h2 className="font-display text-accent text-lg mb-2">Zone de danger</h2>
        <p className="text-sm text-ink-muted mb-4">
          La suppression de votre compte est irréversible. Tous vos crédits, photos et historique seront définitivement effacés.
        </p>

        {!showDeleteForm ? (
          <button
            onClick={() => setShowDeleteForm(true)}
            className="border border-accent/40 text-accent px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/10 transition-colors"
          >
            Supprimer mon compte
          </button>
        ) : (
          <form onSubmit={handleDeleteAccount} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">
                Mot de passe actuel (pour confirmer)
              </label>
              <input
                type="password"
                value={deletePwd}
                onChange={(e) => setDeletePwd(e.target.value)}
                maxLength={128}
                autoComplete="current-password"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">
                Tapez <span className="font-mono font-bold text-accent">SUPPRIMER</span> pour confirmer
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className={inputClass}
                placeholder="SUPPRIMER"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowDeleteForm(false); setDeleteConfirm(""); setDeletePwd(""); }}
                className="flex-1 border border-ink/15 text-ink py-2 rounded-xl text-sm font-semibold hover:bg-cream-2 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={deleteLoading || deleteConfirm !== "SUPPRIMER"}
                className="flex-1 bg-accent text-white py-2 rounded-xl text-sm font-semibold hover:bg-accent-hover disabled:opacity-40 transition-colors shadow-md"
              >
                {deleteLoading ? "Suppression..." : "Supprimer définitivement"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
