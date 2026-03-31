"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { INPAINTING_CREDITS_COST } from "@/config/plans";
import { Pencil, Loader2, CheckCircle2, Download } from "lucide-react";

export default function EditorPage() {
  const { photoId } = useParams<{ photoId: string }>();
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ resultUrl: string } | null>(null);
  const [error, setError] = useState("");

  const EXAMPLES = [
    "Retire le canapé et remplace par un canapé gris moderne",
    "Débâche la piscine",
    "Retire les objets en désordre sur la table",
    "Ajoute une plante décorative dans le coin",
    "Retire l'étiquette de prix",
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instruction.trim() || instruction.length < 5) {
      setError("Décrivez ce que vous voulez modifier (minimum 5 caractères)");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/inpaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, instruction }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la retouche");
        return;
      }

      setResult(data);
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2"><Pencil className="w-6 h-6 text-violet-400" /> Retouche sur instruction</h1>
      <p className="text-zinc-400 mb-8">
        Décrivez ce que vous souhaitez modifier — l'IA s'occupe du reste.
        <span className="text-brand-600 font-medium ml-1">
          {INPAINTING_CREDITS_COST} crédits
        </span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Votre instruction
          </label>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder='Ex: "Retire le canapé rouge et remplace-le par un canapé gris moderne"'
            className="w-full border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
          <p className="text-xs text-zinc-600 mt-1 text-right">
            {instruction.length}/300
          </p>
        </div>

        {/* Exemples */}
        <div>
          <p className="text-xs text-zinc-500 mb-2 font-medium">Exemples :</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setInstruction(ex)}
                className="text-xs bg-white/5 hover:bg-brand-500/10 hover:text-brand-400 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !instruction.trim()}
          className="w-full bg-brand-600 text-white py-4 rounded-xl font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Traitement IA en cours... (30-60s)
            </span>
          ) : (
            `Retoucher — ${INPAINTING_CREDITS_COST} crédits`
          )}
        </button>
      </form>

      {/* Résultat */}
      {result && (
        <div className="mt-8 bg-surface rounded-2xl border border-white/8 p-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Résultat</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.resultUrl}
            alt="Résultat retouche"
            className="w-full rounded-xl"
          />
          <a
            href={result.resultUrl}
            download="pictaura_inpainting.jpg"
            className="mt-4 block w-full text-center bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors"
          >
            <span className="flex items-center justify-center gap-2"><Download className="w-4 h-4" /> Télécharger</span>
          </a>
        </div>
      )}
    </div>
  );
}
