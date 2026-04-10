"use client";

import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useSession } from "next-auth/react";
import { INPAINTING_CREDITS_COST } from "@/config/plans";
import {
  Building2,
  Camera,
  ShoppingBag,
  Store,
  Upload,
  Loader2,
  Download,
  CheckCircle2,
  XCircle,
  Pencil,
} from "lucide-react";

type EditorState =
  | { step: "upload" }
  | { step: "retouching" }
  | { step: "validating"; inpaintingJobId: string; resultUrl: string }
  | { step: "done"; resultUrl: string };

const PLATFORMS = [
  { id: "AIRBNB", label: "Airbnb", icon: Building2 },
  { id: "INSTAGRAM", label: "Instagram", icon: Camera },
  { id: "VINTED", label: "Vinted", icon: ShoppingBag },
  { id: "SHOPIFY", label: "Shopify", icon: Store },
];

const EXAMPLES = [
  "Eclaircis la piece et rends la lumiere plus naturelle",
  "Supprime les objets en desordre sur la table",
  "Retire l'etiquette de prix du produit",
  "Remplace le fond par un mur blanc propre",
  "Ajoute une plante decorative dans le coin",
  "Rends les couleurs plus chaudes et accueillantes",
];

function BeforeAfterSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function updatePos(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPos((x / rect.width) * 100);
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden select-none cursor-col-resize"
      style={{ aspectRatio: "4/3" }}
      onMouseMove={(e) => { if (dragging.current) updatePos(e.clientX); }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
      onTouchMove={(e) => updatePos(e.touches[0].clientX)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt="Apres" className="absolute inset-0 w-full h-full object-cover" />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt="Avant" className="absolute inset-0 w-full h-full object-cover" />
      </div>
      <div className="absolute top-3 left-3 bg-black/60 text-white text-xs font-semibold px-2 py-1 rounded-full pointer-events-none">
        Avant
      </div>
      <div className="absolute top-3 right-3 bg-violet-600/90 text-white text-xs font-semibold px-2 py-1 rounded-full pointer-events-none">
        Apres
      </div>
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/80 shadow-lg"
        style={{ left: `${pos}%` }}
        onMouseDown={(e) => { e.preventDefault(); dragging.current = true; }}
        onTouchStart={() => { dragging.current = true; }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-[var(--surface)] rounded-full shadow-lg flex items-center justify-center border border-white/10">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5 8H1M15 8h-4M5 5L2 8l3 3M11 5l3 3-3 3" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function DirectEditorPage() {
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [platform, setPlatform] = useState("AIRBNB");
  const [instruction, setInstruction] = useState("");
  const [state, setState] = useState<EditorState>({ step: "upload" });
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const credits = session?.user?.credits ?? 0;
  const isAdmin = session?.user?.role === "ADMIN";

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setState({ step: "upload" });
    setError("");
    const url = URL.createObjectURL(f);
    setPreview(url);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Ajoutez une photo"); return; }
    if (!instruction.trim() || instruction.length < 5) {
      setError("Décrivez ce que vous souhaitez modifier (min 5 caractères)");
      return;
    }
    if (!isAdmin && credits < INPAINTING_CREDITS_COST) {
      setError(`${INPAINTING_CREDITS_COST} crédits requis (vous en avez ${credits})`);
      return;
    }

    setState({ step: "retouching" });
    setError("");
    setProgress(5);
    progressRef.current = setInterval(() => {
      setProgress((p) => p < 85 ? p + Math.random() * 8 : p);
    }, 800);

    try {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("instruction", instruction);
      formData.append("platform", platform);

      const res = await fetch("/api/inpaint-direct", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la retouche");
        setState({ step: "upload" });
        return;
      }

      setProgress(100);
      // Go to validation step — credits NOT yet deducted
      setTimeout(() => {
        setState({
          step: "validating",
          inpaintingJobId: data.inpaintingJobId,
          resultUrl: data.resultUrl,
        });
      }, 300);
    } catch {
      setError("Erreur réseau. Réessayez.");
      setState({ step: "upload" });
    } finally {
      if (progressRef.current) clearInterval(progressRef.current);
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
        setState({ step: "upload" });
        setInstruction("");
      }
    } catch {
      setError("Erreur réseau. Réessayez.");
    }
  }

  async function handleDownload() {
    const resultUrl = state.step === "done" ? state.resultUrl : null;
    if (!resultUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(resultUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pictaura_retouche.jpg";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
    } catch {
      setError("Erreur lors du téléchargement");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-2">Retouche sur instruction</h1>
      <p className="text-zinc-400 mb-8">
        Décrivez ce que vous souhaitez modifier — l'IA s'en charge.{" "}
        <span className="text-violet-400 font-medium">{INPAINTING_CREDITS_COST} credits</span>
      </p>

      {/* UPLOAD + RETOUCHING: form */}
      {(state.step === "upload" || state.step === "retouching") && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Upload */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 mb-2">1. Votre photo</h2>
            {preview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Aperçu" className="w-full rounded-xl max-h-64 object-cover" />
                <button
                  type="button"
                  onClick={() => { setFile(null); setPreview(null); setState({ step: "upload" }); }}
                  className="absolute top-2 right-2 bg-[var(--surface)] text-zinc-400 hover:text-red-400 rounded-full w-7 h-7 flex items-center justify-center shadow border border-white/10 text-lg"
                  disabled={state.step === "retouching"}
                >
                  x
                </button>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? "border-violet-400 bg-violet-500/10" : "border-white/10 hover:border-violet-400 hover:bg-white/[0.02]"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-8 h-8 text-[var(--muted)] mx-auto mb-2" />
                <p className="text-zinc-300 font-medium text-sm">
                  {isDragActive ? "Déposez ici..." : "Glissez votre photo ou cliquez"}
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">JPEG, PNG, WEBP · Max 20 Mo</p>
              </div>
            )}
          </div>

          {/* Platform */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 mb-2">2. Contexte</h2>
            <div className="flex gap-2 flex-wrap">
              {PLATFORMS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    disabled={state.step === "retouching"}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                      platform === p.id
                        ? "border-violet-500 bg-violet-500/10 text-violet-400"
                        : "border-white/8 text-zinc-400 hover:border-white/15"
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Instruction */}
          <div>
            <h2 className="text-sm font-semibold text-zinc-300 mb-2">3. Votre instruction</h2>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              maxLength={300}
              rows={3}
              disabled={state.step === "retouching"}
              placeholder='Ex : "Éclaircis la pièce et rends la lumière plus naturelle"'
              className="w-full border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none bg-transparent text-white disabled:opacity-50"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  disabled={state.step === "retouching"}
                  onClick={() => setInstruction(ex)}
                  className="text-xs bg-white/5 hover:bg-violet-500/10 hover:text-violet-400 text-zinc-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={state.step === "retouching" || !file || !instruction.trim()}
            className="w-full bg-gradient-to-r from-violet-600 to-blue-600 text-white py-4 rounded-xl font-semibold hover:from-violet-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.step === "retouching" ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Traitement IA en cours... ({Math.round(progress)}%)
              </span>
            ) : (
              `Retoucher — ${INPAINTING_CREDITS_COST} crédit(s)`
            )}
          </button>

          {state.step === "retouching" && (
            <div className="w-full bg-white/8 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 bg-gradient-to-r from-violet-600 to-blue-600 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </form>
      )}

      {/* VALIDATING: before/after + approve/reject */}
      {state.step === "validating" && preview && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Résultat prêt — <strong>aucun crédit débité pour l&apos;instant.</strong>
          </p>

          <BeforeAfterSlider before={preview} after={state.resultUrl} />

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

          {preview && <BeforeAfterSlider before={preview} after={state.resultUrl} />}

          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white py-3 rounded-xl font-semibold hover:from-violet-700 hover:to-blue-700 transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> {downloading ? "Téléchargement..." : "Télécharger"}
            </button>
            <button
              onClick={() => { setState({ step: "upload" }); setInstruction(""); setError(""); }}
              className="flex-1 flex items-center justify-center gap-2 bg-white/5 text-zinc-300 py-3 rounded-xl font-semibold hover:bg-white/8 transition-colors border border-white/8"
            >
              <Pencil className="w-3.5 h-3.5" /> Nouvelle retouche
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
