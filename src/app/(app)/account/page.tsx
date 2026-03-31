"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useToast } from "@/components/ui/Toaster";

export default function AccountPage() {
  const { data: session, update } = useSession();
  const { toast } = useToast();

  // ── Nom ───────────────────────────────────────────────────
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

  // ── Mot de passe ──────────────────────────────────────────
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

  // ── Suppression ───────────────────────────────────────────
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

  const isGoogleAccount = !session?.user?.email?.includes("@") ? false :
    // Google accounts n'ont pas de passwordHash — on déduit via l'absence de provider credentials
    false; // simplification : on affiche le formulaire, l'API renverra une erreur claire si compte Google

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-white mb-8">Mon compte</h1>

      {/* ── Infos compte ────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-white/8 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-brand-500/15 rounded-full flex items-center justify-center text-2xl font-bold text-brand-400">
            {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div>
            <p className="font-semibold text-white">{session?.user?.name ?? "Utilisateur"}</p>
            <p className="text-sm text-zinc-500">{session?.user?.email}</p>
            <span className="inline-block mt-1 text-xs bg-brand-500/10 text-brand-400 px-2 py-0.5 rounded-full font-medium">
              {session?.user?.role === "ADMIN" ? "Administrateur" : "Utilisateur"}
            </span>
          </div>
        </div>

        {/* Modifier le nom */}
        <form onSubmit={handleUpdateName} className="space-y-3">
          <label className="block text-sm font-medium text-zinc-300">Nom affiché</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
              className="flex-1 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Votre nom"
            />
            <button
              type="submit"
              disabled={nameLoading}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {nameLoading ? "..." : "Sauvegarder"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Changer le mot de passe ──────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-white/8 p-6 mb-6">
        <h2 className="font-semibold text-white mb-4">Changer le mot de passe</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Mot de passe actuel</label>
            <input
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              required
              maxLength={128}
              autoComplete="current-password"
              className="w-full border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Nouveau mot de passe</label>
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              className="w-full border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Minimum 8 caractères"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              required
              maxLength={128}
              autoComplete="new-password"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                confirmPwd && confirmPwd !== newPwd ? "border-red-500/30" : "border-white/10"
              }`}
            />
            {confirmPwd && confirmPwd !== newPwd && (
              <p className="text-xs text-red-600 mt-1">Les mots de passe ne correspondent pas</p>
            )}
          </div>
          <button
            type="submit"
            disabled={pwdLoading || (!!confirmPwd && confirmPwd !== newPwd)}
            className="w-full bg-brand-600 text-white py-2.5 rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {pwdLoading ? "Changement en cours..." : "Changer le mot de passe"}
          </button>
        </form>
      </div>

      {/* ── Zone de danger ───────────────────────────────────── */}
      <div className="bg-surface rounded-2xl border border-red-500/20 p-6">
        <h2 className="font-semibold text-red-400 mb-2">Zone de danger</h2>
        <p className="text-sm text-zinc-400 mb-4">
          La suppression de votre compte est irréversible. Tous vos crédits, photos et historique seront définitivement effacés.
        </p>

        {!showDeleteForm ? (
          <button
            onClick={() => setShowDeleteForm(true)}
            className="border border-red-500/25 text-red-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-500/10 transition-colors"
          >
            Supprimer mon compte
          </button>
        ) : (
          <form onSubmit={handleDeleteAccount} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Mot de passe actuel (pour confirmer)
              </label>
              <input
                type="password"
                value={deletePwd}
                onChange={(e) => setDeletePwd(e.target.value)}
                maxLength={128}
                autoComplete="current-password"
                className="w-full border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">
                Tapez <span className="font-mono font-bold text-red-600">SUPPRIMER</span> pour confirmer
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="w-full border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                placeholder="SUPPRIMER"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowDeleteForm(false); setDeleteConfirm(""); setDeletePwd(""); }}
                className="flex-1 border border-white/10 text-zinc-300 py-2 rounded-xl text-sm font-medium hover:bg-[#0a0a0a]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={deleteLoading || deleteConfirm !== "SUPPRIMER"}
                className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-40"
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
