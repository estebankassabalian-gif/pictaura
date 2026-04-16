"use client";

import { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Upload,
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Send,
  ImageIcon,
  X,
  Copy,
  Check,
} from "lucide-react";
import { MAX_PHOTOS_PER_BATCH, MAX_FILE_SIZE_MB } from "@/config/plans";
import { AGENTS, type AgentSuggestion } from "@/config/agents";

type Step = "upload" | "configure";

interface PhotoConfig {
  file: File;
  previewUrl: string;
  customInstruction: string;
}

export function RetouchePage({ agentKey }: { agentKey: string }) {
  const agent = AGENTS[agentKey];
  const { data: session } = useSession();
  const router = useRouter();
  const Icon = agent.icon;

  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [photoConfigs, setPhotoConfigs] = useState<PhotoConfig[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [applyToAll, setApplyToAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");

  const credits = session?.user?.credits ?? 0;
  const isAdmin = session?.user?.role === "ADMIN";

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError("");
    const newFiles = [...files, ...acceptedFiles].slice(0, MAX_PHOTOS_PER_BATCH);
    setFiles(newFiles);
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
  }

  function handleStartConfigure() {
    if (files.length === 0) {
      setError("Ajoutez au moins une photo");
      return;
    }
    setError("");

    const configs: PhotoConfig[] = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      customInstruction: "",
    }));

    setPhotoConfigs(configs);
    setActivePhotoIndex(0);
    setStep("configure");
  }

  function setCustomInstruction(photoIndex: number, value: string) {
    setPhotoConfigs((prev) => {
      const next = [...prev];
      next[photoIndex] = { ...next[photoIndex], customInstruction: value };
      return next;
    });
  }

  function applyPresetSuggestion(photoIndex: number, suggestion: AgentSuggestion) {
    setPhotoConfigs((prev) => {
      const next = [...prev];
      const trimmed = next[photoIndex].customInstruction.trim();
      next[photoIndex] = {
        ...next[photoIndex],
        customInstruction: trimmed ? `${trimmed}. ${suggestion.prompt}` : suggestion.prompt,
      };
      return next;
    });
  }

  function buildInstructionForPhoto(config: PhotoConfig): string {
    return config.customInstruction.trim() || "Improve the overall quality of the photo.";
  }

  const allInstructions = useMemo(() => {
    if (photoConfigs.length === 0) return [];
    if (applyToAll) {
      const firstInstruction = buildInstructionForPhoto(photoConfigs[0]);
      return photoConfigs.map(() => firstInstruction);
    }
    return photoConfigs.map((config) => buildInstructionForPhoto(config));
  }, [photoConfigs, applyToAll]);

  const currentConfig = photoConfigs[activePhotoIndex];

  async function handleProcess() {
    if (!isAdmin && credits < files.length) {
      setError(`Crédits insuffisants : ${files.length} requis, ${credits} disponibles`);
      return;
    }
    setLoading(true);
    setError("");
    setUploadProgress("Création du traitement...");

    try {
      // Étape 1 : Créer le job (léger, pas de fichier)
      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset: agent.id,
          photoCount: files.length,
          instructions: allInstructions,
        }),
      });

      const jobData = await jobRes.json();
      if (!jobRes.ok) {
        setError(jobData.error ?? "Erreur lors de la création du traitement.");
        return;
      }

      const { jobId } = jobData;

      // Étape 2 : Upload chaque photo une par une (1 requête = 1 photo)
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Upload photo ${i + 1}/${files.length}...`);

        const formData = new FormData();
        formData.append("photo", files[i]);
        formData.append("instruction", allInstructions[i] || "");

        const photoRes = await fetch(`/api/jobs/${jobId}/photos`, {
          method: "POST",
          body: formData,
        });

        if (!photoRes.ok) {
          const photoData = await photoRes.json().catch(() => ({}));
          setError(photoData.error ?? `Erreur lors de l'upload de la photo ${i + 1}.`);
          return;
        }
      }

      // Étape 3 : Lancer le traitement
      setUploadProgress("Lancement du traitement...");
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
      setUploadProgress("");
    }
  }

  const progressSteps = [
    { key: "upload", label: "Photos" },
    { key: "configure", label: "Instructions" },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${agent.gradient} flex items-center justify-center shadow-md`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-display tracking-tight text-ink">{agent.name}</h1>
          <p className="text-sm text-ink-muted">{agent.description}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {progressSteps.map((s, i) => {
          const isDone = s.key === "upload" && step !== "upload";
          const isCurrent = s.key === step;
          return (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isDone
                    ? "bg-accent/15 text-accent"
                    : isCurrent
                    ? "bg-gradient-to-br " + agent.gradient + " text-white"
                    : "bg-white text-ink-muted border border-ink/10"
                }`}
              >
                {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${isCurrent ? "text-[var(--text)] font-medium" : "text-[var(--muted)]"}`}>
                {s.label}
              </span>
              {i < 1 && <div className="flex-1 h-px bg-[var(--border)]" />}
            </div>
          );
        })}
      </div>

      {/* STEP 1: Upload */}
      {step === "upload" && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wider">Ajoutez vos photos</h2>
            <span className="text-xs text-[var(--muted)]">
              {isAdmin ? "Crédits illimités" : `${credits} crédit(s)`}
            </span>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-6 md:p-12 text-center cursor-pointer transition-all mb-4 bg-white ${
              isDragActive
                ? "border-accent bg-accent/5"
                : "border-ink/15 hover:border-accent hover:bg-cream-2"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 text-accent mx-auto mb-3" />
            <p className="text-ink font-semibold text-sm">
              {isDragActive ? "Déposez vos photos ici..." : "Glissez vos photos ici, ou cliquez pour sélectionner"}
            </p>
            <p className="text-xs text-ink-muted mt-2">
              JPEG, PNG, WEBP, HEIC — Max {MAX_FILE_SIZE_MB} Mo — Max {MAX_PHOTOS_PER_BATCH} photos
            </p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="mb-6 space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-white border border-ink/10 rounded-xl px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <ImageIcon className="w-4 h-4 text-ink-muted" />
                    <div>
                      <div className="text-sm font-semibold text-ink truncate max-w-64">{file.name}</div>
                      <div className="text-xs text-ink-muted">{(file.size / 1024 / 1024).toFixed(1)} Mo</div>
                    </div>
                  </div>
                  <button onClick={() => removeFile(index)} className="text-ink-muted hover:text-accent transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="text-xs text-accent font-bold pl-1">
                {files.length} photo(s) — {files.length} crédit(s)
              </div>
            </div>
          )}

          {error && (
            <div className="bg-accent/10 border border-accent/30 text-accent text-sm rounded-xl px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleStartConfigure}
            disabled={files.length === 0}
            className="btn-primary w-full py-4 text-base"
          >
            <Sparkles className="w-5 h-5" />
            Configurer les retouches
          </button>
        </div>
      )}

      {/* STEP 2: Configure per-photo instructions */}
      {step === "configure" && currentConfig && (
        <div className="animate-fade-in">
          <button
            onClick={() => setStep("upload")}
            disabled={loading}
            className="text-sm text-ink-muted hover:text-accent mb-4 flex items-center gap-1 transition-colors disabled:opacity-30"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour
          </button>

          {files.length > 1 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-ink">
                  Photo {activePhotoIndex + 1} / {files.length}
                </h2>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {photoConfigs.map((config, idx) => {
                  const hasConfig = config.customInstruction.trim().length > 0;
                  return (
                    <button
                      key={idx}
                      onClick={() => setActivePhotoIndex(idx)}
                      disabled={applyToAll && idx !== 0}
                      className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        activePhotoIndex === idx
                          ? "border-accent ring-2 ring-accent/25"
                          : applyToAll && idx !== 0
                          ? "border-ink/10 opacity-40"
                          : "border-ink/10 hover:border-accent/60"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={config.previewUrl} alt={config.file.name} className="w-full h-full object-cover" />
                      {hasConfig && (
                        <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-accent rounded-full flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      {applyToAll && idx > 0 && (
                        <div className="absolute inset-0 bg-brand/40 flex items-center justify-center">
                          <Copy className="w-3.5 h-3.5 text-cream/80" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Photo preview */}
            <div>
              <div className="rounded-xl overflow-hidden border border-ink/10 bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentConfig.previewUrl}
                  alt={currentConfig.file.name}
                  className="w-full h-auto max-h-[400px] object-contain bg-cream-2"
                />
              </div>
              <p className="text-xs text-ink-muted mt-2 truncate">{currentConfig.file.name}</p>
            </div>

            {/* Instructions */}
            <div>
              <div className="mb-4">
                <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">Suggestions</h3>
                <div className="flex flex-wrap gap-1.5">
                  {agent.suggestions.slice(0, 6).map((s) => {
                    const SIcon = s.icon;
                    return (
                      <button
                        key={s.label}
                        onClick={() => applyPresetSuggestion(activePhotoIndex, s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ink/15 bg-white text-xs text-ink hover:border-accent hover:bg-accent/5 hover:text-accent transition-all"
                      >
                        <SIcon className="w-3 h-3" />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">Vos instructions</h3>
                <div className="relative">
                  <textarea
                    value={currentConfig.customInstruction}
                    onChange={(e) => setCustomInstruction(activePhotoIndex, e.target.value)}
                    placeholder="Ex: Retirer le poteau électrique, ajouter un ciel bleu..."
                    className="w-full bg-white border border-ink/15 rounded-xl px-4 py-3 pr-10 text-sm text-ink placeholder:text-ink-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none resize-none transition-colors"
                    rows={3}
                    maxLength={300}
                  />
                  <div className="absolute bottom-2 right-3 text-[10px] text-ink-muted">
                    {currentConfig.customInstruction.length}/300
                  </div>
                </div>
              </div>

              {files.length > 1 && (
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={applyToAll}
                    onChange={(e) => setApplyToAll(e.target.checked)}
                    className="rounded border-ink/30 accent-accent"
                  />
                  <span className="text-xs text-ink-muted">Appliquer à toutes les photos</span>
                </label>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-accent/10 border border-accent/30 text-accent text-sm rounded-xl px-4 py-3 mb-4 mt-4">
              {error}
            </div>
          )}

          {/* Navigation + Actions */}
          <div className="flex flex-col gap-3 mt-6">
            {/* Navigation arrows (multi-photo, not applyToAll) */}
            {files.length > 1 && !applyToAll && !loading && (
              <div className="flex gap-2">
                <button
                  onClick={() => setActivePhotoIndex(activePhotoIndex - 1)}
                  disabled={activePhotoIndex === 0}
                  className="btn-outline px-4 py-2.5 disabled:opacity-30"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Précédente
                </button>
                <button
                  onClick={() => setActivePhotoIndex(activePhotoIndex + 1)}
                  disabled={activePhotoIndex === files.length - 1}
                  className="btn-outline flex-1 py-2.5 disabled:opacity-30"
                >
                  Photo suivante ({activePhotoIndex < files.length - 1 ? activePhotoIndex + 2 : files.length}/{files.length})
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Launch button — always visible */}
            <button
              onClick={handleProcess}
              disabled={loading || (!isAdmin && credits < files.length)}
              className="btn-primary w-full py-3.5 text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {uploadProgress || "Envoi en cours..."}
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Lancer la retouche — {files.length} crédit(s)
                </>
              )}
            </button>
          </div>

          {!isAdmin && credits < files.length && (
            <p className="text-sm text-accent mt-2 text-center">
              Crédits insuffisants ({credits} disponible(s), {files.length} requis).{" "}
              <a href="/billing" className="underline font-semibold">Voir les abonnements</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
