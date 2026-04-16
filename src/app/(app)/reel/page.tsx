"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useSession } from "next-auth/react";
import { Upload, CheckCircle2, Film, Loader2, Download, Info } from "lucide-react";
import { REEL_CREDITS_COST } from "@/config/plans";

const STYLES = [
  { id: "zoom-in", label: "Zoom avant", desc: "Classique — focalise sur le sujet" },
  { id: "zoom-out", label: "Zoom arriere", desc: "Revele l'ensemble progressivement" },
  { id: "pan-right", label: "Pan droite", desc: "Panoramique cinematique" },
  { id: "pan-left", label: "Pan gauche", desc: "Panoramique inverse" },
  { id: "diagonal", label: "Diagonal", desc: "Zoom + pan — le plus dynamique" },
];

const FILTERS = [
  { id: "cinematic", label: "Cinematic", desc: "Orange & Teal — Hollywood" },
  { id: "warm", label: "Warm", desc: "Golden hour" },
  { id: "none", label: "Aucun", desc: "Photo originale" },
];

export default function ReelPage() {
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [style, setStyle] = useState("zoom-in");
  const [filter, setFilter] = useState("cinematic");
  const [duration, setDuration] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ reelUrl: string; sizeMb: number; duration: number } | null>(null);

  const credits = session?.user?.credits ?? 0;
  const isAdmin = session?.user?.role === "ADMIN";

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
      setResult(null);
      setError("");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  async function handleGenerate() {
    if (!file) { setError("Ajoutez une photo"); return; }
    if (!isAdmin && credits < REEL_CREDITS_COST) {
      setError(`${REEL_CREDITS_COST} crédits requis (vous en avez ${credits})`);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("style", style);
      formData.append("filter", filter);
      formData.append("duration", String(duration));

      const res = await fetch("/api/reel", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la génération");
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
      <h1 className="text-3xl md:text-4xl font-display tracking-tight text-ink mb-2">Reel Instagram — Effet Ken Burns</h1>
      <p className="text-ink-muted text-sm mb-6">
        Transformez une photo en vidéo MP4 animée 9:16 · {REEL_CREDITS_COST} crédits ·{" "}
        {isAdmin ? "Admin — crédits illimités" : `${credits} crédit(s) disponibles`}
      </p>

      <div className="bg-sun/15 border border-sun/40 rounded-xl px-4 py-3 mb-6 text-sm text-ink flex items-start gap-2.5">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <strong>Pourquoi un Reel ?</strong> Les Reels ont 3-5x plus de reach que les photos statiques
          sur Instagram (algo 2025). Le mouvement arrête le scroll en &lt;200ms.
        </div>
      </div>

      {/* Upload */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors mb-6 ${
          isDragActive
            ? "border-accent bg-accent/5"
            : file
            ? "border-accent/40 bg-accent/5"
            : "border-ink/15 bg-white hover:border-accent hover:bg-cream-2"
        }`}
      >
        <input {...getInputProps()} />
        {file ? (
          <div>
            <CheckCircle2 className="w-8 h-8 text-accent mx-auto mb-2" />
            <p className="font-semibold text-ink">{file.name}</p>
            <p className="text-xs text-ink-muted mt-1">{(file.size / 1024 / 1024).toFixed(1)} Mo · Cliquez pour changer</p>
          </div>
        ) : (
          <div>
            <Upload className="w-8 h-8 text-accent mx-auto mb-3" />
            <p className="text-ink font-semibold">
              {isDragActive ? "Déposez la photo ici..." : "Glissez ou cliquez pour sélectionner une photo"}
            </p>
            <p className="text-xs text-ink-muted mt-1">JPEG, PNG, WEBP · Max 20 Mo</p>
          </div>
        )}
      </div>

      {/* Style */}
      <div className="mb-5">
        <h2 className="text-sm font-bold text-ink uppercase tracking-wider mb-2">Style de mouvement</h2>
        <div className="space-y-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                style === s.id
                  ? "border-accent bg-accent/10"
                  : "border-ink/15 bg-white hover:border-accent/50"
              }`}
            >
              <span className="font-semibold text-sm text-ink">{s.label}</span>
              <span className="text-xs text-ink-muted ml-2">— {s.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter */}
      <div className="mb-5">
        <h2 className="text-sm font-bold text-ink uppercase tracking-wider mb-2">Filtre couleur</h2>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-1 py-2 rounded-lg border text-sm transition-all ${
                filter === f.id
                  ? "border-accent bg-accent/10 text-accent font-semibold"
                  : "border-ink/15 bg-white text-ink-muted hover:border-accent/50 hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-ink uppercase tracking-wider mb-2">
          Duree : <span className="text-accent">{duration}s</span>
        </h2>
        <input
          type="range"
          min={3}
          max={8}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full accent-[#f87005]"
        />
        <div className="flex justify-between text-xs text-ink-muted mt-1">
          <span>3s (loop court = algo boost)</span>
          <span>8s</span>
        </div>
      </div>

      {error && (
        <div className="bg-accent/10 border border-accent/30 text-accent text-sm rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading || !file}
        className="w-full bg-accent text-white py-4 rounded-xl font-semibold text-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-6 shadow-md"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Generation en cours (20-40s)...
          </span>
        ) : (
          `Generer le Reel — ${REEL_CREDITS_COST} credits`
        )}
      </button>

      {/* Result */}
      {result && (
        <div className="bg-white border border-ink/10 rounded-2xl p-5 shadow-sm">
          <h2 className="font-display text-ink text-lg mb-3 flex items-center gap-2">
            <Film className="w-5 h-5 text-accent" /> Reel genere
          </h2>
          <video
            src={result.reelUrl}
            controls
            autoPlay
            loop
            muted
            className="w-full rounded-xl mb-4 max-h-96 object-contain bg-cream-2"
          />
          <div className="flex items-center justify-between text-sm text-ink-muted mb-4">
            <span>{result.duration}s · {result.sizeMb} Mo · 1080x1920</span>
          </div>
          <a
            href={result.reelUrl}
            download="reel-instagram.mp4"
            className="flex items-center justify-center gap-2 w-full text-center bg-accent text-white py-3 rounded-xl font-semibold hover:bg-accent-hover transition-colors shadow-md"
          >
            <Download className="w-4 h-4" /> Telecharger le MP4
          </a>
        </div>
      )}
    </div>
  );
}
