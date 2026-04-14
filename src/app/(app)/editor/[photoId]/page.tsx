"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { INPAINTING_CREDITS_COST } from "@/config/plans";
import { Pencil, Loader2, CheckCircle2, XCircle, Download, Send } from "lucide-react";

type EditorState =
  | { step: "idle" }
  | { step: "retouching" }
  | { step: "validating"; inpaintingJobId: string; resultUrl: string }
  | { step: "done"; resultUrl: string };

export default function EditorPage() {
  const { photoId } = useParams<{ photoId: string }>();
  const [instruction, setInstruction] = useState("");
  const [state, setState] = useState<EditorState>({ step: "idle" });
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

    setState({ step: "retouching" });
    setError("");

    try {
      const res = await fetch("/api/inpaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, instruction }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la retouche");
        setState({ step: "idle" });
        return;
      }

      // Go to validation step (credits not yet deducted)
      setState({
        step: "validating",
        inpaintingJobId: data.inpaintingJobId,
        resultUrl: data.resultUrl,
      });
    } catch {
      setError("Erreur réseau. Réessayez.");
      setState({ step: "idle" });
    }
  }

  async function handleValidate(action: "approve" | "reject") {
    if (state.step !== "validating") return;

    try {
      const res = await fetch("/api/inpaint-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inpaintingJobId: state.inpaintingJobId, action }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la validation");
        return;
      }

      if (action === "approve") {
        setState({ step: "done", resultUrl: data.resultUrl ?? state.resultUrl });
      } else {
        setState({ step: "idle" });
        setInstruction("");
      }
    } catch {
      setError("Erreur réseau. Réessayez.");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
        <Pencil className="w-6 h-6 text-accent-400" /> Retouche sur instruction
      </h1>
      <p className="text-zinc-400 mb-8">
        Décrivez ce que vous souhaitez modifier — l'IA s'occupe du reste.
        <span className="text-accent-400 font-medium ml-1">
          {INPAINTING_CREDITS_COST} crédit(s) — débité uniquement si vous validez
        </span>
      </p>

      {/* IDLE: instruction form */}
      {(state.step === "idle" || state.step === "retouching") && (
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
              disabled={state.step === "retouching"}
              placeholder='Ex: "Retire le canapé rouge et remplace-le par un canapé gris moderne"'
              className="w-full border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 resize-none bg-transparent text-white disabled:opacity-50"
            />
            <p className="text-xs text-zinc-600 mt-1 text-right">{instruction.length}/300</p>
          </div>

          <div>
            <p className="text-xs text-zinc-500 mb-2 font-medium">Exemples :</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  disabled={state.step === "retouching"}
                  onClick={() => setInstruction(ex)}
                  className="text-xs bg-white/5 hover:bg-accent-500/10 hover:text-accent-400 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={state.step === "retouching" || !instruction.trim()}
            className="w-full bg-gradient-to-r from-brand-600 to-accent-500 text-white py-4 rounded-xl font-semibold hover:from-brand-700 hover:to-accent-600 transition-all disabled:opacity-50"
          >
            {state.step === "retouching" ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Traitement IA en cours... (30-60s)
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                Retoucher — {INPAINTING_CREDITS_COST} crédit(s)
              </span>
            )}
          </button>
        </form>
      )}

      {/* VALIDATING: before/after + approve/reject */}
      {state.step === "validating" && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Résultat prêt — <strong>aucun crédit débité pour l'instant.</strong>
          </p>

          <div className="rounded-xl overflow-hidden border border-white/8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.resultUrl} alt="Résultat retouche" className="w-full" />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleValidate("approve")}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors text-sm"
            >
              <CheckCircle2 className="w-4 h-4" /> Valider — {INPAINTING_CREDITS_COST} crédit
            </button>
            <button
              onClick={() => handleValidate("reject")}
              className="flex-1 flex items-center justify-center gap-2 bg-white/5 text-zinc-300 py-3 rounded-xl font-semibold hover:bg-white/8 transition-colors text-sm border border-white/8"
            >
              <XCircle className="w-4 h-4" /> Rejeter — gratuit
            </button>
          </div>
        </div>
      )}

      {/* DONE: download result */}
      {state.step === "done" && (
        <div className="space-y-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-400">Retouche validée — {INPAINTING_CREDITS_COST} crédit débité</p>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.resultUrl} alt="Résultat retouche" className="w-full rounded-xl border border-white/8" />

          <div className="flex gap-3">
            <a
              href={state.resultUrl}
              download="pictaura_retouche.jpg"
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-accent-500 text-white py-3 rounded-xl font-semibold hover:from-brand-700 hover:to-accent-600 transition-all"
            >
              <Download className="w-4 h-4" /> Télécharger
            </a>
            <button
              onClick={() => { setState({ step: "idle" }); setInstruction(""); }}
              className="flex-1 flex items-center justify-center gap-2 bg-white/5 text-zinc-300 py-3 rounded-xl font-semibold hover:bg-white/8 transition-colors border border-white/8"
            >
              <Pencil className="w-3.5 h-3.5" /> Nouvelle retouche
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}
    </div>
  );
}
