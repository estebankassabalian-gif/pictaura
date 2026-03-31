"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  MAX_PHOTOS_PER_BATCH,
  MAX_FILE_SIZE_MB,
  PRESET_LABELS,
} from "@/config/plans";
import { Preset } from "@prisma/client";
import { Building2, Camera, ShoppingBag, Store, Upload, ImageIcon, Loader2, Sparkles } from "lucide-react";

const PRESETS = [
  { id: "IMMOBILIER" as Preset, icon: Building2, label: "Immobilier", desc: "Annonces immo, Airbnb, agences" },
  { id: "INSTAGRAM" as Preset, icon: Camera, label: "Instagram", desc: "Réseaux sociaux, lifestyle" },
  { id: "VINTED" as Preset, icon: ShoppingBag, label: "Vinted", desc: "Marketplace, seconde main" },
  { id: "SHOPIFY" as Preset, icon: Store, label: "E-commerce", desc: "Shopify, Amazon, produit" },
];

type Step = "upload" | "analyze" | "confirm";

interface AISuggestion {
  text: string;
  checked: boolean;
}

export default function UploadPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // Step management
  const [step, setStep] = useState<Step>("upload");

  // Step 1: Upload
  const [files, setFiles] = useState<File[]>([]);
  const [preset, setPreset] = useState<Preset>("IMMOBILIER");

  // Step 2: AI Analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [customInstruction, setCustomInstruction] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Step 3: Processing
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const credits = session?.user?.credits ?? 0;
  const isAdmin = session?.user?.role === "ADMIN";

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError("");
    const newFiles = [...files, ...acceptedFiles].slice(0, MAX_PHOTOS_PER_BATCH);
    setFiles(newFiles);
    // Preview de la premiere photo
    if (newFiles[0]) {
      const url = URL.createObjectURL(newFiles[0]);
      setPreviewUrl(url);
    }
  }, [files]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/heic": [".heic"],
    },
    maxFiles: MAX_PHOTOS_PER_BATCH,
    maxSize: MAX_FILE_SIZE_MB * 1024 * 1024,
  });

  function removeFile(index: number) {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    if (newFiles[0]) {
      setPreviewUrl(URL.createObjectURL(newFiles[0]));
    } else {
      setPreviewUrl(null);
    }
  }

  // Step 1 → Step 2: Analyze with AI
  async function handleAnalyze() {
    if (files.length === 0) {
      setError("Ajoutez au moins une photo");
      return;
    }

    setAnalyzing(true);
    setError("");

    try {
      const fd = new FormData();
      fd.append("photo", files[0]);
      fd.append("preset", preset);

      const res = await fetch("/api/analyze-ai", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'analyse");
        return;
      }

      setAiAnalysis(data.analysis);
      setSuggestions(
        (data.suggestions as string[]).map((s: string) => ({ text: s, checked: true }))
      );
      setStep("analyze");
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleSuggestion(index: number) {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, checked: !s.checked } : s))
    );
  }

  // Build final instruction from checked suggestions + custom text
  function buildInstruction(): string {
    const parts: string[] = [];
    const checked = suggestions.filter((s) => s.checked).map((s) => s.text);
    if (checked.length > 0) {
      parts.push(checked.join(". "));
    }
    if (customInstruction.trim()) {
      parts.push(customInstruction.trim());
    }
    return parts.join(". ") || "Améliorer la qualité globale de la photo.";
  }

  // Step 2 → Step 3: Launch processing
  async function handleProcess() {
    if (!isAdmin && credits < files.length) {
      setError(`Crédits insuffisants : ${files.length} requis, ${credits} disponibles`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const instruction = buildInstruction();

      const formData = new FormData();
      formData.append("preset", preset);
      formData.append("subOption", instruction);
      files.forEach((file) => formData.append("photos", file));

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        setError(uploadData.error ?? "Erreur lors de l'upload");
        return;
      }

      const { jobId } = uploadData;

      const processRes = await fetch(`/api/process/${jobId}`, { method: "POST" });
      if (!processRes.ok) {
        const processData = await processRes.json().catch(() => ({}));
        setError(processData.error ?? "Erreur lors du lancement du traitement.");
        return;
      }

      router.push(`/results/${jobId}`);
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Progress bar ───────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { key: "upload", label: "1. Photo & contexte" },
          { key: "analyze", label: "2. Analyse IA" },
          { key: "confirm", label: "3. Retouche" },
        ].map((s, i) => {
          const isActive = s.key === step || (s.key === "confirm" && step === "analyze");
          const isDone =
            (s.key === "upload" && step !== "upload") ||
            (s.key === "analyze" && step === "confirm");
          return (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  isDone
                    ? "bg-green-500 text-white"
                    : isActive || s.key === step
                    ? "bg-brand-500 text-white"
                    : "bg-white/5 text-zinc-500"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <span className={`text-sm hidden sm:block ${s.key === step ? "text-white font-medium" : "text-zinc-500"}`}>
                {s.label}
              </span>
              {i < 2 && <div className="flex-1 h-px bg-white/10" />}
            </div>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════
          STEP 1: Photo + Contexte
         ══════════════════════════════════════════════════════ */}
      {step === "upload" && (
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Nouvelle retouche</h1>
          <p className="text-zinc-400 mb-8">
            {isAdmin ? "Crédits illimités (admin)" : `${credits} crédit(s) disponible(s)`}
          </p>

          {/* Preset selector */}
          <h2 className="text-base font-semibold text-zinc-300 mb-3">
            Choisissez votre contexte
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  preset === p.id
                    ? "border-brand-500 bg-brand-500/10"
                    : "border-white/8 hover:border-white/20"
                }`}
              >
                <p.icon className="w-6 h-6 mb-1 text-violet-400" />
                <div className="font-semibold text-sm text-white">{p.label}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>

          {/* Upload zone */}
          <h2 className="text-base font-semibold text-zinc-300 mb-3">
            Ajoutez vos photos (max {MAX_PHOTOS_PER_BATCH})
          </h2>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors mb-4 ${
              isDragActive
                ? "border-brand-400 bg-brand-500/10"
                : "border-white/10 hover:border-brand-400 hover:bg-white/[0.02]"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-10 h-10 mx-auto mb-3 text-zinc-500" />
            <p className="text-zinc-300 font-medium">
              {isDragActive
                ? "Déposez vos photos ici..."
                : "Glissez vos photos ici, ou cliquez pour sélectionner"}
            </p>
            <p className="text-sm text-zinc-500 mt-2">
              JPEG, PNG, WEBP, HEIC · Max {MAX_FILE_SIZE_MB} Mo · Max {MAX_PHOTOS_PER_BATCH} photos
            </p>
          </div>

          {/* Preview files */}
          {files.length > 0 && (
            <div className="mb-6 space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-surface border border-white/8 rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <ImageIcon className="w-5 h-5 text-zinc-400" />
                    <div>
                      <div className="text-sm font-medium text-white truncate max-w-64">
                        {file.name}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {(file.size / 1024 / 1024).toFixed(1)} Mo
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-zinc-600 hover:text-red-400 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="text-sm text-brand-400 font-medium pl-1">
                {files.length} photo(s) · {files.length} crédit(s) requis
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={analyzing || files.length === 0}
            className="w-full bg-brand-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyse IA en cours...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Analyser avec l&apos;IA
              </>
            )}
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STEP 2: AI Analysis + Suggestions + Custom instruction
         ══════════════════════════════════════════════════════ */}
      {step === "analyze" && (
        <div>
          <button
            onClick={() => setStep("upload")}
            className="text-sm text-zinc-400 hover:text-white mb-4 flex items-center gap-1 transition-colors"
          >
            ← Retour
          </button>

          <h1 className="text-2xl font-bold text-white mb-1">Analyse IA</h1>
          <p className="text-zinc-400 mb-6">
            L'IA a analysé votre photo et propose des retouches. Cochez celles que vous souhaitez, ou ajoutez vos propres instructions.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Photo preview */}
            <div>
              {previewUrl && (
                <div className="rounded-xl overflow-hidden border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-auto max-h-[400px] object-contain bg-black"
                  />
                </div>
              )}
              {files.length > 1 && (
                <p className="text-xs text-zinc-500 mt-2">
                  + {files.length - 1} autre(s) photo(s) — les mêmes retouches seront appliquées
                </p>
              )}
            </div>

            {/* Suggestions + Custom */}
            <div>
              {/* AI Analysis */}
              <div className="bg-surface border border-white/8 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-brand-400 text-sm font-semibold flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Analyse</span>
                </div>
                <p className="text-sm text-zinc-300">{aiAnalysis}</p>
              </div>

              {/* Suggestions checkboxes */}
              <div className="space-y-2 mb-4">
                <h3 className="text-sm font-semibold text-zinc-300">Retouches proposées</h3>
                {suggestions.map((s, i) => (
                  <label
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      s.checked
                        ? "border-brand-500/50 bg-brand-500/5"
                        : "border-white/8 hover:border-white/15"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={s.checked}
                      onChange={() => toggleSuggestion(i)}
                      className="mt-0.5 rounded border-white/20 bg-white/5 text-brand-500 focus:ring-brand-500 focus:ring-offset-0"
                    />
                    <span className={`text-sm ${s.checked ? "text-white" : "text-zinc-400"}`}>
                      {s.text}
                    </span>
                  </label>
                ))}
              </div>

              {/* Custom instruction bar */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-zinc-300 mb-2">
                  Vos instructions (optionnel)
                </h3>
                <textarea
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  placeholder="Ex: Retirer le poteau électrique, ajouter un ciel bleu, rendre l'herbe plus verte..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none resize-none transition-colors"
                  rows={3}
                  maxLength={300}
                />
                <div className="text-xs text-zinc-600 mt-1 text-right">
                  {customInstruction.length}/300
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep("upload")}
              className="px-6 py-4 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 transition-colors font-medium"
            >
              ← Modifier
            </button>
            <button
              onClick={handleProcess}
              disabled={loading || (suggestions.every((s) => !s.checked) && !customInstruction.trim())}
              className="flex-1 bg-brand-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Retouche en cours...
                </>
              ) : (
                `Lancer la retouche — ${files.length} crédit(s)`
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
