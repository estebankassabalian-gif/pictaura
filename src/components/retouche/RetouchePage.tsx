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

type Step = "upload" | "configure" | "confirm";

interface PhotoConfig {
  file: File;
  previewUrl: string;
  suggestions: { text: string; checked: boolean }[];
  customInstruction: string;
  aiAnalysis: string;
  analyzed: boolean;
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
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
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

  // Initialize photo configs and analyze first photo
  async function handleStartConfigure() {
    if (files.length === 0) {
      setError("Ajoutez au moins une photo");
      return;
    }
    setAnalyzing(true);
    setError("");

    // Create configs for all photos
    const configs: PhotoConfig[] = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      suggestions: [],
      customInstruction: "",
      aiAnalysis: "",
      analyzed: false,
    }));

    // Analyze first photo with AI
    try {
      const fd = new FormData();
      fd.append("photo", files[0]);
      fd.append("preset", agent.id);
      const res = await fetch("/api/analyze-ai", { method: "POST", body: fd });
      const data = await res.json();

      if (res.ok && !data.fallback) {
        configs[0].aiAnalysis = data.analysis;
        configs[0].suggestions = (data.suggestions as string[]).map((s: string) => ({
          text: s,
          checked: true,
        }));
      } else {
        configs[0].aiAnalysis = "Suggestions adaptees a votre secteur";
      }
      configs[0].analyzed = true;
    } catch {
      configs[0].aiAnalysis = "Suggestions adaptees a votre secteur";
      configs[0].analyzed = true;
    }

    setPhotoConfigs(configs);
    setActivePhotoIndex(0);
    setStep("configure");
    setAnalyzing(false);
  }

  // Analyze a specific photo when navigating to it
  async function analyzePhoto(index: number) {
    if (photoConfigs[index]?.analyzed) return;

    setAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append("photo", files[index]);
      fd.append("preset", agent.id);
      const res = await fetch("/api/analyze-ai", { method: "POST", body: fd });
      const data = await res.json();

      setPhotoConfigs((prev) => {
        const next = [...prev];
        if (res.ok && !data.fallback) {
          next[index] = {
            ...next[index],
            aiAnalysis: data.analysis,
            suggestions: (data.suggestions as string[]).map((s: string) => ({
              text: s,
              checked: true,
            })),
            analyzed: true,
          };
        } else {
          next[index] = {
            ...next[index],
            aiAnalysis: "Suggestions adaptees a votre secteur",
            analyzed: true,
          };
        }
        return next;
      });
    } catch {
      setPhotoConfigs((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          aiAnalysis: "Suggestions adaptees a votre secteur",
          analyzed: true,
        };
        return next;
      });
    } finally {
      setAnalyzing(false);
    }
  }

  async function goToPhoto(index: number) {
    setActivePhotoIndex(index);
    await analyzePhoto(index);
  }

  function toggleSuggestion(photoIndex: number, suggIndex: number) {
    setPhotoConfigs((prev) => {
      const next = [...prev];
      const suggestions = [...next[photoIndex].suggestions];
      suggestions[suggIndex] = { ...suggestions[suggIndex], checked: !suggestions[suggIndex].checked };
      next[photoIndex] = { ...next[photoIndex], suggestions };
      return next;
    });
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
    const parts: string[] = [];
    const checked = config.suggestions.filter((s) => s.checked).map((s) => s.text);
    if (checked.length > 0) parts.push(checked.join(". "));
    if (config.customInstruction.trim()) parts.push(config.customInstruction.trim());
    return parts.join(". ") || "Improve the overall quality of the photo.";
  }

  // Build instructions array for all photos
  const allInstructions = useMemo(() => {
    if (photoConfigs.length === 0) return [];
    if (applyToAll) {
      const firstInstruction = buildInstructionForPhoto(photoConfigs[0]);
      return photoConfigs.map(() => firstInstruction);
    }
    return photoConfigs.map((config) => buildInstructionForPhoto(config));
  }, [photoConfigs, applyToAll]);

  const currentConfig = photoConfigs[activePhotoIndex];
  const hasInstruction = currentConfig
    ? currentConfig.suggestions.some((s) => s.checked) || currentConfig.customInstruction.trim().length > 0
    : false;

  // Check if all photos have at least one instruction
  const allConfigured = useMemo(() => {
    if (photoConfigs.length === 0) return false;
    if (applyToAll) return hasInstruction; // first photo needs instruction
    return photoConfigs.every(
      (c) => c.suggestions.some((s) => s.checked) || c.customInstruction.trim().length > 0
    );
  }, [photoConfigs, applyToAll, hasInstruction]);

  async function handleProcess() {
    if (!isAdmin && credits < files.length) {
      setError(`Credits insuffisants : ${files.length} requis, ${credits} disponibles`);
      return;
    }
    if (!allConfigured) {
      setError("Configurez les retouches pour chaque photo avant de lancer.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("preset", agent.id);
      // Send per-photo instructions as JSON array
      formData.append("instructions", JSON.stringify(allInstructions));
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
      setError("Erreur reseau. Reessayez.");
    } finally {
      setLoading(false);
    }
  }

  const progressSteps = [
    { key: "upload", label: "Photos" },
    { key: "configure", label: "Instructions" },
    { key: "confirm", label: "Retouche" },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${agent.gradient} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">{agent.name}</h1>
          <p className="text-sm text-[var(--muted)]">{agent.description}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {progressSteps.map((s, i) => {
          const isDone = (s.key === "upload" && step !== "upload") || (s.key === "configure" && step === "confirm");
          const isCurrent = s.key === step;
          return (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  isDone
                    ? "bg-emerald-500/20 text-emerald-400"
                    : isCurrent
                    ? "bg-gradient-to-br " + agent.gradient + " text-white"
                    : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]"
                }`}
              >
                {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${isCurrent ? "text-[var(--text)] font-medium" : "text-[var(--muted)]"}`}>
                {s.label}
              </span>
              {i < 2 && <div className="flex-1 h-px bg-[var(--border)]" />}
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
              {isAdmin ? "Credits illimites" : `${credits} credit(s)`}
            </span>
          </div>

          <div
            {...getRootProps()}
            className={`border border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all mb-4 ${
              isDragActive
                ? "border-[var(--accent)] bg-[var(--accent-dim)]"
                : "border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface)]"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 text-[var(--muted)] mx-auto mb-3" />
            <p className="text-[var(--text)] font-medium text-sm">
              {isDragActive ? "Deposez vos photos ici..." : "Glissez vos photos ici, ou cliquez pour selectionner"}
            </p>
            <p className="text-xs text-[var(--muted)] mt-2">
              JPEG, PNG, WEBP, HEIC — Max {MAX_FILE_SIZE_MB} Mo — Max {MAX_PHOTOS_PER_BATCH} photos
            </p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="mb-6 space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <ImageIcon className="w-4 h-4 text-[var(--muted)]" />
                    <div>
                      <div className="text-sm font-medium text-[var(--text)] truncate max-w-64">{file.name}</div>
                      <div className="text-xs text-[var(--muted)]">{(file.size / 1024 / 1024).toFixed(1)} Mo</div>
                    </div>
                  </div>
                  <button onClick={() => removeFile(index)} className="text-[var(--muted)] hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="text-xs text-[var(--accent)] font-medium pl-1">
                {files.length} photo(s) — {files.length} credit(s)
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleStartConfigure}
            disabled={analyzing || files.length === 0}
            className="btn-primary w-full py-4 text-base"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyse en cours...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                {files.length > 1 ? "Configurer les retouches" : "Analyser avec l'IA"}
              </>
            )}
          </button>
        </div>
      )}

      {/* STEP 2: Configure per-photo instructions */}
      {step === "configure" && currentConfig && (
        <div className="animate-fade-in">
          <button
            onClick={() => setStep("upload")}
            className="text-sm text-[var(--muted)] hover:text-[var(--text)] mb-4 flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour
          </button>

          {/* Photo navigation */}
          {files.length > 1 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-[var(--text)]">
                  Photo {activePhotoIndex + 1} / {files.length}
                </h2>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToAll}
                    onChange={(e) => setApplyToAll(e.target.checked)}
                    className="rounded border-white/20"
                  />
                  <span className="text-xs text-[var(--muted)]">Appliquer a toutes les photos</span>
                </label>
              </div>

              {/* Thumbnails */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {photoConfigs.map((config, idx) => {
                  const hasConfig = config.suggestions.some((s) => s.checked) || config.customInstruction.trim().length > 0;
                  return (
                    <button
                      key={idx}
                      onClick={() => goToPhoto(idx)}
                      disabled={applyToAll && idx !== 0}
                      className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        activePhotoIndex === idx
                          ? "border-violet-500 ring-2 ring-violet-500/20"
                          : applyToAll && idx !== 0
                          ? "border-white/5 opacity-40"
                          : "border-white/8 hover:border-white/20"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={config.previewUrl} alt={config.file.name} className="w-full h-full object-cover" />
                      {hasConfig && (
                        <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      {applyToAll && idx > 0 && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Copy className="w-3.5 h-3.5 text-white/70" />
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
              <div className="rounded-xl overflow-hidden border border-[var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentConfig.previewUrl}
                  alt={currentConfig.file.name}
                  className="w-full h-auto max-h-[400px] object-contain bg-black"
                />
              </div>
              <p className="text-xs text-[var(--muted)] mt-2 truncate">{currentConfig.file.name}</p>
            </div>

            {/* Suggestions + Custom */}
            <div>
              {analyzing ? (
                <div className="bg-blue-500/10 rounded-xl p-4 flex items-center gap-3 mb-4">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  <p className="text-sm text-blue-400">Analyse IA en cours...</p>
                </div>
              ) : (
                <>
                  {/* AI Analysis */}
                  {currentConfig.aiAnalysis && (
                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                        <span className="text-sm font-semibold text-[var(--text)]">Analyse</span>
                      </div>
                      <p className="text-sm text-[var(--muted)]">{currentConfig.aiAnalysis}</p>
                    </div>
                  )}

                  {/* AI Suggestions (checkboxes) */}
                  {currentConfig.suggestions.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Retouches recommandees</h3>
                      {currentConfig.suggestions.map((s, i) => (
                        <label
                          key={i}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            s.checked
                              ? "border-[var(--accent)]/30 bg-[var(--accent-dim)]"
                              : "border-[var(--border)] hover:border-[var(--border)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={s.checked}
                            onChange={() => toggleSuggestion(activePhotoIndex, i)}
                            className="mt-0.5"
                          />
                          <span className={`text-sm ${s.checked ? "text-[var(--text)]" : "text-[var(--muted)]"}`}>
                            {s.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Preset suggestions (quick buttons) */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Suggestions rapides</h3>
                <div className="flex flex-wrap gap-1.5">
                  {agent.suggestions.slice(0, 6).map((s) => {
                    const SIcon = s.icon;
                    return (
                      <button
                        key={s.label}
                        onClick={() => applyPresetSuggestion(activePhotoIndex, s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)]/30 hover:bg-[var(--accent-dim)] transition-all"
                      >
                        <SIcon className="w-3 h-3" />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom instruction */}
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">Vos instructions</h3>
                <div className="relative">
                  <textarea
                    value={currentConfig.customInstruction}
                    onChange={(e) => setCustomInstruction(activePhotoIndex, e.target.value)}
                    placeholder="Ex: Retirer le poteau electrique, ajouter un ciel bleu..."
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 pr-10 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-dim)] focus:outline-none resize-none transition-colors"
                    rows={3}
                    maxLength={300}
                  />
                  <div className="absolute bottom-2 right-3 text-[10px] text-[var(--muted)]">
                    {currentConfig.customInstruction.length}/300
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-4 mt-4">
              {error}
            </div>
          )}

          {/* Navigation + Actions */}
          <div className="flex gap-3 mt-6">
            {/* Previous photo */}
            {files.length > 1 && activePhotoIndex > 0 && !applyToAll && (
              <button
                onClick={() => goToPhoto(activePhotoIndex - 1)}
                className="btn-outline px-4 py-3.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Precedente
              </button>
            )}

            {/* Next photo or Launch */}
            {files.length > 1 && activePhotoIndex < files.length - 1 && !applyToAll ? (
              <button
                onClick={() => goToPhoto(activePhotoIndex + 1)}
                disabled={!hasInstruction}
                className="btn-primary flex-1 py-3.5 text-base"
              >
                Photo suivante ({activePhotoIndex + 2}/{files.length})
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleProcess}
                disabled={loading || !allConfigured || (!isAdmin && credits < files.length)}
                className="btn-primary flex-1 py-3.5 text-base"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Lancer la retouche — {files.length} credit(s)
                  </>
                )}
              </button>
            )}
          </div>

          {!isAdmin && credits < files.length && (
            <p className="text-sm text-red-400 mt-2 text-center">
              Credits insuffisants ({credits} disponible(s), {files.length} requis).{" "}
              <a href="/billing" className="underline text-violet-400">Acheter des credits</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
