"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Send,
  X,
  Copy,
  Check,
} from "lucide-react";
import { MAX_PHOTOS_PER_BATCH, MAX_FILE_SIZE_MB } from "@/config/plans";
import { AGENTS, type AgentSuggestion } from "@/config/agents";
import { getPlatformsForPreset, getPlatformById } from "@/config/platforms";

type Step = "upload" | "configure";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface PhotoConfig {
  file: File;
  previewUrl: string;
  customInstruction: string;
  platformId: string | null;
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
  const [uploadedCount, setUploadedCount] = useState(0);
  const [error, setError] = useState("");

  const credits = session?.user?.credits ?? 0;
  const isAdmin = session?.user?.role === "ADMIN";

  // Miniatures réelles pour l'étape 1 (fluide et concret dès le dépôt, au
  // lieu d'une liste de noms de fichiers). Révoquées au démontage / changement.
  const previewUrls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => {
    return () => previewUrls.forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrls]);

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
      "image/heif": [".heif"],
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
      platformId: null,
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

  function setPhotoPlatform(photoIndex: number, platformId: string | null) {
    setPhotoConfigs((prev) => {
      const next = [...prev];
      next[photoIndex] = { ...next[photoIndex], platformId };
      return next;
    });
  }

  function buildInstructionForPhoto(config: PhotoConfig): string {
    // Vide si l'utilisateur n'a rien écrit : le backend applique alors
    // l'instruction par défaut du preset (source de vérité unique — un défaut
    // codé en dur ici court-circuitait les défauts métier du pipeline).
    const userPart = config.customInstruction.trim();
    if (!userPart) return "";
    const platform = config.platformId ? getPlatformById(agent.id, config.platformId) : undefined;
    if (!platform) return userPart;
    return `${userPart}\n\n${platform.promptHint}`;
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
    setUploadedCount(0);
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

      // Étape 2 : Upload des photos en parallèle (3 connexions) avec 1 retry
      // réseau par photo. Le séquentiel faisait payer ~1-2s × N photos avant
      // même que le traitement IA ne démarre.
      const UPLOAD_CONCURRENCY = 3;
      let uploadedCount = 0;
      let nextUploadIndex = 0;
      let uploadAborted = false;

      const uploadOne = async (i: number): Promise<void> => {
        // En mode "appliquer à toutes", toutes les photos reprennent la plateforme
        // choisie sur la photo 0 (même logique que customInstruction).
        const sourceConfig = applyToAll ? photoConfigs[0] : photoConfigs[i];
        const platformId = sourceConfig?.platformId ?? "";

        const formData = new FormData();
        formData.append("photo", files[i]);
        formData.append("instruction", allInstructions[i] || "");
        if (platformId) formData.append("platformId", platformId);

        for (let attempt = 0; attempt < 2; attempt++) {
          const photoRes = await fetch(`/api/jobs/${jobId}/photos`, {
            method: "POST",
            body: formData,
          }).catch(() => null);

          if (photoRes?.ok) return;
          // Erreur métier (4xx) : inutile de retenter, le serveur refusera pareil
          if (photoRes && photoRes.status < 500) {
            const photoData = await photoRes.json().catch(() => ({}));
            throw new Error(photoData.error ?? `Erreur lors de l'upload de la photo ${i + 1}.`);
          }
          // Erreur réseau / 5xx : un retry (connexions mobiles instables)
          if (attempt === 1) {
            throw new Error(`Erreur lors de l'upload de la photo ${i + 1}. Vérifiez votre connexion.`);
          }
        }
      };

      const uploadWorker = async (): Promise<void> => {
        while (!uploadAborted) {
          const i = nextUploadIndex++;
          if (i >= files.length) return;
          await uploadOne(i);
          uploadedCount++;
          setUploadedCount(uploadedCount);
          setUploadProgress(`Upload des photos : ${uploadedCount}/${files.length}...`);
        }
      };

      try {
        await Promise.all(
          Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, () => uploadWorker())
        );
      } catch (e) {
        uploadAborted = true;
        setError(e instanceof Error ? e.message : "Erreur lors de l'upload des photos.");
        return;
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

      <AnimatePresence mode="wait">
      {/* STEP 1: Upload */}
      {step === "upload" && (
        <motion.div
          key="upload"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
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

          {/* Grille de miniatures — concret dès le dépôt */}
          {files.length > 0 && (
            <div className="mb-6">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-3">
                <AnimatePresence initial={false}>
                  {files.map((file, index) => (
                    <motion.div
                      key={`${file.name}-${file.size}-${index}`}
                      layout
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-ink/10 bg-cream-2 shadow-sm"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrls[index]}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <button
                        onClick={() => removeFile(index)}
                        aria-label={`Retirer ${file.name}`}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-ink/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <span className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold text-white bg-ink/60 rounded-full px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(file.size / 1024 / 1024).toFixed(1)} Mo
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
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
        </motion.div>
      )}

      {/* STEP 2: Configure per-photo instructions */}
      {step === "configure" && currentConfig && (
        <motion.div
          key="configure"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
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
              {/* Platform selector (optional) */}
              {getPlatformsForPreset(agent.id).length > 0 && (
                <div className="mb-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider">
                      Plateforme cible
                    </h3>
                    <span className="text-[10px] text-ink-muted/70">Optionnel</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setPhotoPlatform(activePhotoIndex, null)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                        currentConfig.platformId === null
                          ? "border-accent bg-accent/10 text-accent font-medium"
                          : "border-ink/15 bg-white text-ink-muted hover:border-accent/60 hover:text-accent"
                      }`}
                    >
                      Aucune
                    </button>
                    {getPlatformsForPreset(agent.id).map((p) => {
                      const PIcon = p.icon;
                      const isSelected = currentConfig.platformId === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setPhotoPlatform(activePhotoIndex, p.id)}
                          title={`${p.description} — ${p.ratio} (${p.dimensions})`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                            isSelected
                              ? "border-accent bg-accent/10 text-accent font-medium"
                              : "border-ink/15 bg-white text-ink hover:border-accent hover:bg-accent/5 hover:text-accent"
                          }`}
                        >
                          <PIcon className="w-3 h-3" />
                          {p.name}
                          <span className="text-[10px] opacity-70">{p.ratio}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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

            {/* Barre de progression réelle pendant l'upload — fluide, pas
                juste un spinner opaque sur ce qui peut prendre plusieurs
                secondes pour un gros lot. */}
            {loading && files.length > 1 && (
              <div className="w-full h-1.5 bg-ink/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-accent rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (uploadedCount / files.length) * 100)}%` }}
                  transition={{ duration: 0.3, ease: EASE }}
                />
              </div>
            )}
          </div>

          {!isAdmin && credits < files.length && (
            <p className="text-sm text-accent mt-2 text-center">
              Crédits insuffisants ({credits} disponible(s), {files.length} requis).{" "}
              <a href="/billing" className="underline font-semibold">Voir les abonnements</a>
            </p>
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
