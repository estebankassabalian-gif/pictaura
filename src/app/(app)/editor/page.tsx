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
} from "lucide-react";

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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
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
    setResult(null);
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

    setLoading(true);
    setError("");
    setResult(null);
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
        return;
      }

      setProgress(100);
      setTimeout(() => setResult(data.resultUrl), 300);
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      if (progressRef.current) clearInterval(progressRef.current);
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!result) return;
    setDownloading(true);
    try {
      const res = await fetch(result);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pictaura_retouche.jpg";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Erreur lors du telechargement");
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Upload */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-2">1. Votre photo</h2>
          {preview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Apercu" className="w-full rounded-xl max-h-64 object-cover" />
              <button
                type="button"
                onClick={() => { setFile(null); setPreview(null); setResult(null); }}
                className="absolute top-2 right-2 bg-[var(--surface)] text-zinc-400 hover:text-red-400 rounded-full w-7 h-7 flex items-center justify-center shadow border border-white/10 text-lg"
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
            placeholder='Ex : "Eclaircis la piece et rends la lumiere plus naturelle"'
            className="w-full border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none bg-transparent text-white"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setInstruction(ex)}
                className="text-xs bg-white/5 hover:bg-violet-500/10 hover:text-violet-400 text-zinc-400 px-3 py-1.5 rounded-lg transition-colors"
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
          disabled={loading || !file || !instruction.trim()}
          className="w-full bg-gradient-to-r from-violet-600 to-blue-600 text-white py-4 rounded-xl font-semibold hover:from-violet-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Analyse IA en cours... ({Math.round(progress)}%)
            </span>
          ) : (
            `Retoucher — ${INPAINTING_CREDITS_COST} credits`
          )}
        </button>

        {loading && (
          <div className="w-full bg-white/8 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 bg-gradient-to-r from-violet-600 to-blue-600 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </form>

      {/* Result with before/after slider */}
      {result && preview && (
        <div className="mt-8 bg-[var(--surface)] rounded-2xl border border-white/8 p-6">
          <h2 className="font-semibold text-white mb-1">Résultat</h2>
          <p className="text-xs text-zinc-500 mb-4">Glissez le curseur pour comparer avant / apres</p>
          <BeforeAfterSlider before={preview} after={result} />
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white py-3 rounded-xl font-semibold hover:from-violet-700 hover:to-blue-700 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading ? "Telechargement..." : "Telecharger la photo retouchee"}
          </button>
        </div>
      )}
    </div>
  );
}
