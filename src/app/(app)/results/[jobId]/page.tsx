"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PRESET_LABELS, INPAINTING_CREDITS_COST } from "@/config/plans";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { DEFAULT_SUGGESTIONS, RetouchingSuggestion } from "@/config/retouching-suggestions";
import { getStatusBadgeClasses } from "@/config/agents";
import {
  Loader2,
  Search,
  Lightbulb,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Download,
  Pencil,
  RefreshCw,
  Clock,
  ArrowLeft,
  Send,
} from "lucide-react";

// Types
type Photo = {
  id: string;
  fileName: string;
  status: string;
  originalUrl: string | null;
  processedUrl: string | null;
  fileSizeOriginal: number | null;
  fileSizeProcessed: number | null;
  seoAltText: string | null;
  seoFileName: string | null;
  seoDescription: string | null;
  photoScore: number | null;
  photoScoreReport: string | null;
};

type Job = {
  id: string;
  preset: string;
  status: string;
  photoCount: number;
  photos: Photo[];
  isWatermarked?: boolean;
  etaSeconds?: number;
};

/** "2 min 30" / "45 s" — formatage humain de l'ETA serveur */
function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m} min ${s.toString().padStart(2, "0")}` : `${m} min`;
}

type RetoucheState =
  | { step: "idle" }
  | { step: "analyzing" }
  | { step: "ready"; analysis: string; suggestions: string[]; presetSuggestions: RetouchingSuggestion[] }
  | { step: "retouching" }
  | { step: "validating"; inpaintingJobId: string; resultUrl: string; originalUrl: string }
  | { step: "validated"; resultUrl: string; inpaintingJobId: string }; // legacy, kept for type safety

const PRESETS = ["AIRBNB", "IMMOBILIER", "INSTAGRAM", "SHOPIFY"] as const;

// RetoucheChat
function RetoucheChat({ photo, preset, onPhotoUpdated }: { photo: Photo; preset: string; onPhotoUpdated?: () => void }) {
  const [state, setState] = useState<RetoucheState>({ step: "idle" });
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (photo.status !== "COMPLETED" || !photo.processedUrl) return;
    runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.id]);

  async function runAnalysis() {
    setState({ step: "analyzing" });
    setError("");

    try {
      const res = await fetch("/api/analyze-retouche", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id }),
      });

      const data = await res.json();
      const presetSuggestions = DEFAULT_SUGGESTIONS[preset] ?? DEFAULT_SUGGESTIONS["IMMOBILIER"] ?? [];

      if (!res.ok || data.fallback) {
        setState({
          step: "ready",
          analysis: "Suggestions adaptées à votre secteur",
          suggestions: presetSuggestions.map((s) => s.label),
          presetSuggestions,
        });
        return;
      }

      setState({
        step: "ready",
        analysis: data.analysis,
        suggestions: data.suggestions,
        presetSuggestions,
      });
    } catch {
      const presetSuggestions = DEFAULT_SUGGESTIONS[preset] ?? [];
      setState({
        step: "ready",
        analysis: "Suggestions adaptées à votre secteur",
        suggestions: presetSuggestions.map((s) => s.label),
        presetSuggestions,
      });
    }
  }

  async function handleRetouche(instructionText: string) {
    if (!instructionText.trim() || instructionText.trim().length < 3) {
      setError("Décrivez la retouche souhaitée (minimum 3 caractères)");
      return;
    }

    setState({ step: "retouching" });
    setError("");

    try {
      const res = await fetch("/api/inpaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id, instruction: instructionText.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur lors de la retouche");
        const presetSuggestions = DEFAULT_SUGGESTIONS[preset] ?? [];
        setState({
          step: "ready",
          analysis: "Retouche échouée. Réessayez avec une autre instruction.",
          suggestions: presetSuggestions.map((s) => s.label),
          presetSuggestions,
        });
        return;
      }

      setState({
        step: "validating",
        inpaintingJobId: data.inpaintingJobId,
        resultUrl: data.resultUrl,
        originalUrl: photo.processedUrl ?? "",
      });
    } catch {
      setError("Erreur réseau. Réessayez.");
      const presetSuggestions = DEFAULT_SUGGESTIONS[preset] ?? [];
      setState({
        step: "ready",
        analysis: "Une erreur s'est produite.",
        suggestions: presetSuggestions.map((s) => s.label),
        presetSuggestions,
      });
    }
  }

  async function handleValidate(inpaintingJobId: string, action: "approve" | "reject") {
    const res = await fetch("/api/inpaint-validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inpaintingJobId, action }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Erreur lors de la validation");
      return;
    }

    if (action === "approve") {
      // La photo principale a été mise à jour côté serveur.
      // On notifie le parent pour rafraîchir les données, puis on revient à "ready".
      onPhotoUpdated?.();
      const presetSuggestions = DEFAULT_SUGGESTIONS[preset] ?? [];
      setState({
        step: "ready",
        analysis: "Retouche appliquée avec succès ! Souhaitez-vous affiner davantage ?",
        suggestions: presetSuggestions.map((s) => s.label),
        presetSuggestions,
      });
      setInstruction("");
    } else {
      const presetSuggestions = DEFAULT_SUGGESTIONS[preset] ?? [];
      setState({
        step: "ready",
        analysis: "Résultat rejeté. Décrivez une autre retouche.",
        suggestions: presetSuggestions.map((s) => s.label),
        presetSuggestions,
      });
      setInstruction("");
    }
  }

  function handleSuggestionClick(suggestion: RetouchingSuggestion | string) {
    const prompt = typeof suggestion === "string" ? suggestion : suggestion.prompt;
    const label = typeof suggestion === "string" ? suggestion : suggestion.label;
    setInstruction(label);
    handleRetouche(prompt);
  }

  function handleAffinement() {
    const presetSuggestions = DEFAULT_SUGGESTIONS[preset] ?? [];
    setState({
      step: "ready",
      analysis: "Photo validée. Souhaitez-vous affiner davantage ?",
      suggestions: ["Améliorer encore l'éclairage", "Ajouter plus de détails", "Retouche complémentaire"],
      presetSuggestions,
    });
    setInstruction("");
  }

  if (photo.status !== "COMPLETED") return null;

  return (
    <div className="mt-4 border-t border-ink/10 pt-4">
      <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
        <Pencil className="w-4 h-4 text-accent" /> Retouche IA
      </h3>

      {/* ANALYZING */}
      {state.step === "analyzing" && (
        <div className="bg-sun/15 border border-sun/40 rounded-xl p-4 flex items-center gap-3">
          <Search className="w-5 h-5 text-accent animate-pulse" />
          <p className="text-sm text-ink">Analyse de la photo en cours... (gratuit)</p>
        </div>
      )}

      {/* READY */}
      {state.step === "ready" && (
        <div className="space-y-3">
          <div className="bg-cream-2 border border-ink/10 rounded-xl p-3">
            <p className="text-xs text-ink-muted font-medium mb-1 flex items-center gap-1">
              <Search className="w-3 h-3" /> Analyse
            </p>
            <p className="text-sm text-ink">{state.analysis}</p>
          </div>

          {state.presetSuggestions.length > 0 && (
            <div>
              <p className="text-xs text-ink-muted font-medium mb-2 flex items-center gap-1">
                <Lightbulb className="w-3 h-3" /> Suggestions rapides
              </p>
              <div className="flex flex-wrap gap-2">
                {state.presetSuggestions.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => handleSuggestionClick(s)}
                    className="flex items-center gap-1 text-xs bg-white border border-ink/15 hover:border-accent hover:bg-accent/5 hover:text-accent text-ink px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-ink-muted font-medium mb-1 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Ou décrivez votre retouche
            </p>
            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleRetouche(instruction);
                  }
                }}
                maxLength={300}
                rows={2}
                placeholder='Ex: "Retire la voiture devant la maison"'
                className="flex-1 border border-ink/15 bg-white rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 resize-none"
              />
              <button
                onClick={() => handleRetouche(instruction)}
                disabled={!instruction.trim()}
                className="px-4 py-2 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover disabled:opacity-40 transition-colors self-end shadow-md"
              >
                <Send className="w-4 h-4 sm:hidden" />
                <span className="hidden sm:inline">{INPAINTING_CREDITS_COST} crédit</span>
              </button>
            </div>
            <p className="text-xs text-ink-muted mt-1">
              Le crédit est débité uniquement si vous validez le résultat.
            </p>
          </div>
        </div>
      )}

      {/* RETOUCHING */}
      {state.step === "retouching" && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-accent animate-spin" />
          <div>
            <p className="text-sm font-semibold text-accent">Retouche IA en cours...</p>
            <p className="text-xs text-ink-muted mt-0.5">Pictaura analyse et retouche votre photo (~20-40s)</p>
          </div>
        </div>
      )}

      {/* VALIDATING */}
      {state.step === "validating" && (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            Résultat prêt — <strong>aucun crédit débité pour l'instant.</strong>
          </p>

          <div className="rounded-xl overflow-hidden border border-ink/10">
            <div className="grid grid-cols-2 gap-0">
              <div className="relative">
                <p className="absolute top-2 left-2 bg-brand/80 text-cream text-xs px-2 py-0.5 rounded-full z-10">Avant</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.originalUrl} alt="Avant" className="w-full aspect-video object-cover" />
              </div>
              <div className="relative">
                <p className="absolute top-2 left-2 bg-accent text-white text-xs px-2 py-0.5 rounded-full z-10">Apres</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.resultUrl} alt="Apres retouche" className="w-full aspect-video object-cover" draggable={false} onContextMenu={(e) => e.preventDefault()} />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleValidate(state.inpaintingJobId, "approve")}
              className="flex-1 flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-xl font-semibold hover:bg-accent-hover transition-colors text-sm shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" /> Valider — {INPAINTING_CREDITS_COST} credit
            </button>
            <button
              onClick={() => handleValidate(state.inpaintingJobId, "reject")}
              className="flex-1 flex items-center justify-center gap-2 bg-white text-ink py-3 rounded-xl font-semibold hover:bg-cream-2 transition-colors text-sm border border-ink/15"
            >
              <XCircle className="w-4 h-4" /> Rejeter — gratuit
            </button>
          </div>
        </div>
      )}

      {/* VALIDATED */}
      {state.step === "validated" && (
        <div className="space-y-3">
          <div className="bg-sun/15 border border-sun/40 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-accent" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">Retouche validée — 1 crédit débité</p>
            </div>
            <button
              onClick={async () => {
                try {
                  const res = await fetch(state.resultUrl!);
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "pictaura-retouche.jpg";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch { /* ignore */ }
              }}
              className="flex items-center gap-1 text-xs bg-accent text-white px-3 py-1.5 rounded-lg hover:bg-accent-hover transition-colors"
            >
              <Download className="w-3 h-3" /> Télécharger
            </button>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.resultUrl} alt="Résultat retouche" className="w-full rounded-xl border border-ink/10" draggable={false} onContextMenu={(e) => e.preventDefault()} />

          <button
            onClick={handleAffinement}
            className="w-full flex items-center justify-center gap-2 text-sm text-accent font-medium py-2 border border-accent/30 rounded-xl hover:bg-accent/5 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Affiner encore (nouvelle retouche)
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-2 bg-accent/10 border border-accent/30 text-accent text-xs rounded-xl px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}

// Main Page
export default function ResultsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);
  const [reprocessing, setReprocessing] = useState(false);
  const [actionError, setActionError] = useState("");

  const [fetchError, setFetchError] = useState("");

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        if (res.status === 404) setFetchError("Traitement introuvable.");
        return;
      }
      const data = await res.json();
      setJob(data);
      setFetchError("");
      return data;
    } catch {
      setFetchError("Impossible de charger les résultats. Vérifiez votre connexion.");
    }
  }, [jobId]);

  const [pollTimeout, setPollTimeout] = useState(false);
  // true = le SEO background n'arrivera plus (cap de polling atteint) →
  // afficher un état stable au lieu d'un spinner infini
  const [seoCapped, setSeoCapped] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let cancelled = false;
    // 25 min : un lot de 30 photos à ~60-150s/photo (concurrence 8) peut
    // légitimement tourner ~15-20 min — ne pas afficher "problème" avant.
    const maxPollTime = 25 * 60 * 1000;
    const startTime = Date.now();
    let jobCompletedAt: number | null = null;
    const SEO_POLL_CAP_MS = 90_000; // attendre max 90s après COMPLETED pour que le SEO background finisse

    async function poll() {
      if (cancelled) return;
      if (Date.now() - startTime > maxPollTime) {
        setPollTimeout(true);
        return;
      }
      const data = await fetchJob();
      if (cancelled) return;

      if (data?.status === "FAILED") {
        return;
      }

      if (data?.status === "COMPLETED") {
        if (jobCompletedAt === null) jobCompletedAt = Date.now();
        const seoStillMissing = (data.photos as Photo[]).some(
          (p) => p.status === "COMPLETED" && !p.seoFileName
        );
        const seoElapsed = Date.now() - jobCompletedAt;
        if (!seoStillMissing || seoElapsed > SEO_POLL_CAP_MS) {
          // SEO injecté partout OU délai dépassé → état stable (pas de spinner infini)
          if (seoStillMissing) setSeoCapped(true);
          return;
        }
        // Continue à poller doucement le temps que le SEO background termine
        timeoutId = setTimeout(poll, 2500);
        return;
      }

      // Adaptive polling: 1.5s while processing (fast updates), 3s while pending
      const interval = data?.status === "PROCESSING" ? 1500 : 3000;
      timeoutId = setTimeout(poll, interval);
    }

    poll();
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [fetchJob]);

  async function downloadSinglePhoto(photoId: string) {
    const res = await fetch(`/api/jobs/${jobId}/download?photoId=${photoId}`);
    if (!res.ok) throw new Error("Erreur lors du téléchargement");
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="(.+?)"/);
    const fileName = match?.[1] || `pictaura_${job?.preset?.toLowerCase()}.jpg`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Delay revoke so the browser can start the download
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const [downloadToast, setDownloadToast] = useState("");

  async function downloadPhoto(photoId: string) {
    setDownloading(true);
    setDownloadToast("");
    try {
      await downloadSinglePhoto(photoId);
      setDownloadToast("Photo téléchargée");
      setTimeout(() => setDownloadToast(""), 3000);
    } catch {
      setActionError("Erreur lors du téléchargement");
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadAll() {
    if (!job) return;
    setDownloading(true);
    setActionError("");
    setDownloadToast("");
    try {
      // Un seul ZIP : photos + seo_metadata.csv + hashtags + JSON-LD.
      // Remplace les N téléchargements séquentiels (bloqués par certains
      // navigateurs, pénibles sur mobile).
      const res = await fetch(`/api/jobs/${jobId}/download?format=zip`);
      if (!res.ok) throw new Error("Erreur lors de la génération du ZIP");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+?)"/);
      const fileName = match?.[1] || `pictaura_${job.preset.toLowerCase()}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadToast("ZIP téléchargé — photos + métadonnées SEO");
      setTimeout(() => setDownloadToast(""), 3000);
    } catch {
      setActionError("Erreur lors du téléchargement du ZIP");
    } finally {
      setDownloading(false);
    }
  }

  async function handleReprocess(newPreset: string) {
    if (!job) return;
    setReprocessing(true);
    try {
      const res = await fetch("/api/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, preset: newPreset }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error ?? "Erreur lors du retraitement"); return; }
      router.push(`/results/${data.jobId}`);
    } catch {
      setActionError("Erreur réseau. Réessayez.");
    } finally {
      setReprocessing(false);
    }
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          {fetchError ? (
            <>
              <XCircle className="w-10 h-10 text-accent mx-auto mb-4" />
              <p className="text-accent font-medium mb-2">{fetchError}</p>
              <Link href="/dashboard" className="text-accent hover:text-accent-hover hover:underline text-sm">
                Retour au dashboard
              </Link>
            </>
          ) : (
            <>
              <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto mb-4" />
              <p className="text-ink-muted">Chargement...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const isProcessing = job.status === "PENDING" || job.status === "PROCESSING";
  const completedPhotos = job.photos.filter((p) => p.status === "COMPLETED");
  const photosAwaitingSeo = completedPhotos.filter((p) => !p.seoFileName).length;
  const currentPhoto = job.photos[activePhoto];
  const otherPresets = PRESETS.filter((p) => p !== job.preset);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-display tracking-tight text-ink">
            {PRESET_LABELS[job.preset as keyof typeof PRESET_LABELS] ?? job.preset}
          </h1>
          <p className="text-ink-muted mt-1 text-sm">
            {completedPhotos.length}/{job.photos.length} photos traitées
          </p>
        </div>
        {completedPhotos.length > 0 && (
          <div className="flex flex-col items-end gap-1 self-start sm:self-auto">
            <button
              onClick={completedPhotos.length === 1 ? () => downloadPhoto(completedPhotos[0].id) : handleDownloadAll}
              disabled={downloading}
              className="flex items-center gap-2 bg-accent text-white px-4 md:px-5 py-2.5 rounded-xl font-semibold hover:bg-accent-hover transition-colors disabled:opacity-50 shadow-md text-sm"
            >
              <Download className="w-4 h-4" />
              {downloading ? "Téléchargement..." : completedPhotos.length === 1 ? "Télécharger la photo" : `Tout télécharger (ZIP — ${completedPhotos.length} photos + SEO)`}
            </button>
            {photosAwaitingSeo > 0 && (
              seoCapped ? (
                <span className="text-xs text-accent flex items-center gap-1" title="La génération SEO n'a pas pu aboutir pour ces photos. Les photos elles-mêmes sont prêtes et téléchargeables.">
                  <XCircle className="w-3 h-3" />
                  SEO indisponible sur {photosAwaitingSeo}/{completedPhotos.length} photo{photosAwaitingSeo > 1 ? "s" : ""} — photos téléchargeables
                </span>
              ) : (
                <span className="text-xs text-ink-muted flex items-center gap-1" title="Le SEO est encore en cours d'injection sur certaines photos. Attendez quelques secondes pour avoir toutes les métadonnées dans les fichiers.">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  SEO en cours sur {photosAwaitingSeo}/{completedPhotos.length} photo{photosAwaitingSeo > 1 ? "s" : ""}
                </span>
              )
            )}
          </div>
        )}
      </div>

      {/* Action error */}
      {actionError && (
        <div className="bg-accent/10 border border-accent/30 text-accent text-sm rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError("")} className="text-accent/60 hover:text-accent ml-4">✕</button>
        </div>
      )}

      {/* Download toast */}
      {downloadToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-ink text-cream px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-sun" />
          <span className="text-sm font-medium">{downloadToast}</span>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (() => {
        const processingPhotos = job.photos.filter((p) => p.status === "PROCESSING");
        // ETA calculée côté serveur à partir des durées réellement mesurées
        // (processingMs) — pas d'estimation optimiste qui décrédibilise l'attente.
        const etaSeconds = job.etaSeconds ?? 0;

        return (
          <div className="bg-white border border-ink/10 rounded-xl p-5 mb-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
              <div className="flex-1">
                <p className="font-semibold text-ink">
                  Traitement IA en cours — {completedPhotos.length}/{job.photos.length} terminées
                </p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {etaSeconds > 0 ? `Temps restant estimé : ~${formatEta(etaSeconds)}` : "Finalisation..."}
                  {processingPhotos.length > 0 && ` · ${processingPhotos.length} en cours`}
                </p>
              </div>
            </div>
            <p className="text-xs text-ink-muted bg-cream-2 border border-ink/10 rounded-lg px-3 py-2 mb-3">
              💡 Vous pouvez quitter cette page : le traitement continue en arrière-plan.
              Vos photos vous attendront dans votre dashboard.
            </p>
            <div className="w-full bg-cream-2 rounded-full h-2.5 mb-3 overflow-hidden">
              <div
                className="bg-accent h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(3, (completedPhotos.length / Math.max(job.photos.length, 1)) * 100)}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {job.photos.map((p, i) => (
                <span
                  key={p.id}
                  title={p.fileName}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium ${getStatusBadgeClasses(p.status)}`}
                >
                  {p.status === "COMPLETED" ? <CheckCircle2 className="w-3 h-3" /> :
                   p.status === "FAILED"    ? <XCircle className="w-3 h-3" /> :
                   p.status === "PROCESSING"? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                  Photo {i + 1}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Timeout warning */}
      {pollTimeout && isProcessing && (
        <div className="bg-sun/15 border border-sun/40 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-accent" />
            <div className="flex-1">
              <p className="font-semibold text-ink">Le traitement prend plus de temps que prévu</p>
              <p className="text-xs text-ink-muted mt-1">
                Rechargez la page dans quelques minutes. Si le problème persiste, contactez le support.
              </p>
            </div>
            <button
              onClick={() => { setPollTimeout(false); window.location.reload(); }}
              className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg font-medium hover:bg-accent-hover transition-colors text-sm whitespace-nowrap shadow-md"
            >
              <RefreshCw className="w-4 h-4" /> Recharger
            </button>
          </div>
        </div>
      )}

      {/* Re-process with another preset */}
      {job.status === "COMPLETED" && (
        <div className="bg-white border border-ink/10 rounded-xl p-4 mb-6 shadow-sm">
          <p className="text-sm font-semibold text-ink mb-2 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-accent" /> Essayer un autre preset (1 credit/photo)
          </p>
          <div className="flex gap-2 flex-wrap">
            {otherPresets.map((p) => (
              <button
                key={p}
                onClick={() => handleReprocess(p)}
                disabled={reprocessing}
                className="px-4 py-1.5 text-sm border border-ink/15 bg-white rounded-lg hover:border-accent hover:text-accent text-ink-muted transition-colors disabled:opacity-50"
              >
                {reprocessing ? "..." : PRESET_LABELS[p as keyof typeof PRESET_LABELS]?.split(" /")[0] ?? p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Photo selector */}
      {job.photos.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {job.photos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => setActivePhoto(index)}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                activePhoto === index ? "border-accent ring-2 ring-accent/25" : "border-ink/15"
              }`}
            >
              {photo.originalUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.originalUrl} alt={photo.fileName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-cream-2 flex items-center justify-center">
                  {photo.status === "COMPLETED" ? <CheckCircle2 className="w-4 h-4 text-accent" /> : <Clock className="w-4 h-4 text-ink-muted" />}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Slider + SEO + Retouche */}
      {currentPhoto && (
        <div className="bg-white rounded-2xl border border-ink/10 p-4 md:p-6 mb-6 shadow-sm">
          <h2 className="font-display text-base md:text-lg text-ink mb-4 truncate">{currentPhoto.fileName}</h2>

          {currentPhoto.status === "COMPLETED" && currentPhoto.originalUrl && currentPhoto.processedUrl ? (
            <>
              <BeforeAfterSlider
                beforeUrl={currentPhoto.originalUrl}
                afterUrl={currentPhoto.processedUrl}
                alt={currentPhoto.fileName}
              />
              <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
                <div className="flex gap-4 text-xs text-ink-muted">
                  {currentPhoto.fileSizeOriginal && (
                    <span>Original : {(currentPhoto.fileSizeOriginal / 1024).toFixed(0)} Ko</span>
                  )}
                  {currentPhoto.fileSizeProcessed && (
                    <span>Traité : {(currentPhoto.fileSizeProcessed / 1024).toFixed(0)} Ko</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {currentPhoto.seoFileName ? (
                    <span
                      className="text-xs font-semibold text-green-700 flex items-center gap-1"
                      title="Métadonnées SEO (alt text, keywords, JSON-LD) injectées dans le fichier image"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> SEO prêt
                    </span>
                  ) : seoCapped ? (
                    <span
                      className="text-xs font-medium text-accent flex items-center gap-1"
                      title="La génération SEO n'a pas pu aboutir pour cette photo. La photo elle-même est prête et téléchargeable."
                    >
                      <XCircle className="w-3.5 h-3.5" /> SEO indisponible
                    </span>
                  ) : (
                    <span
                      className="text-xs font-medium text-ink-muted flex items-center gap-1"
                      title="Génération SEO en arrière-plan (~5-15s). Téléchargez après pour avoir toutes les métadonnées dans le fichier."
                    >
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> SEO en cours…
                    </span>
                  )}
                  <button
                    onClick={() => downloadPhoto(currentPhoto.id)}
                    disabled={downloading}
                    className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover transition-colors disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Télécharger cette photo
                  </button>
                </div>
              </div>
            </>
          ) : currentPhoto.status === "FAILED" ? (
            <div className="bg-accent/10 border border-accent/30 rounded-xl p-6 text-center">
              <XCircle className="w-8 h-8 text-accent mx-auto mb-2" />
              <p className="text-accent font-medium">Échec du traitement — crédit remboursé</p>
            </div>
          ) : (
            <div className="bg-cream-2 border border-ink/10 rounded-xl p-12 text-center">
              <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto mb-3" />
              <p className="text-ink-muted">Traitement en cours...</p>
            </div>
          )}

          {/* Watermark notice */}
          {currentPhoto.status === "COMPLETED" && job.isWatermarked === true && (
            <div className="mt-4 bg-sun/15 border border-sun/40 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-accent text-base leading-none">&#128274;</span>
                <p className="text-sm text-ink leading-snug">
                  Vos photos contiennent un watermark Pictaura
                </p>
              </div>
              <Link
                href="/billing"
                className="flex-shrink-0 text-xs font-semibold text-accent hover:text-accent-hover transition-colors whitespace-nowrap"
              >
                S'abonner →
              </Link>
            </div>
          )}

          {/* Retouche IA inline */}
          <RetoucheChat photo={currentPhoto} preset={job.preset} onPhotoUpdated={fetchJob} />
        </div>
      )}

      <div className="text-center">
        <Link href="/dashboard" className="text-accent font-semibold hover:text-accent-hover hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Retour au dashboard
        </Link>
      </div>
    </div>
  );
}
