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
  Copy,
  Check,
  Globe,
  FileText,
  Hash,
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
};

type RetoucheState =
  | { step: "idle" }
  | { step: "analyzing" }
  | { step: "ready"; analysis: string; suggestions: string[]; presetSuggestions: RetouchingSuggestion[] }
  | { step: "retouching" }
  | { step: "validating"; inpaintingJobId: string; resultUrl: string; originalUrl: string }
  | { step: "validated"; resultUrl: string; inpaintingJobId: string };

const PRESETS = ["AIRBNB", "IMMOBILIER", "INSTAGRAM", "VINTED", "SHOPIFY"] as const;

// Copy helper
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-[10px] text-violet-400 hover:text-violet-300 ml-1.5 inline-flex items-center gap-0.5 flex-shrink-0"
    >
      {copied ? <><Check className="w-2.5 h-2.5" /> OK</> : <><Copy className="w-2.5 h-2.5" /> Copier</>}
    </button>
  );
}

// SEO optimization panel
function SeoPanel({ photo, preset }: { photo: Photo; preset: string }) {
  if (photo.status !== "COMPLETED") return null;
  const hasSeo = photo.seoAltText || photo.seoFileName || photo.seoDescription;
  if (!hasSeo) return null;

  const platformTips: Record<string, string> = {
    IMMOBILIER: "Utilisez le alt text dans votre annonce immobiliere et le nom de fichier SEO pour un meilleur referencement sur LeBonCoin, SeLoger, etc.",
    AIRBNB: "Ajoutez la description dans votre annonce Airbnb. Le alt text et le nom de fichier ameliorent votre visibilite sur Google Images.",
    INSTAGRAM: "Utilisez la description comme legende et les hashtags pour maximiser votre portee.",
    VINTED: "Le titre et la description optimises aident vos articles a apparaitre en haut des recherches Vinted.",
    SHOPIFY: "Collez le alt text dans le champ 'Texte alternatif' de Shopify. Renommez le fichier avec le nom SEO avant import.",
  };

  return (
    <div className="mt-4 border-t border-white/5 pt-4">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Optimisation SEO</h3>
      </div>

      <p className="text-xs text-zinc-400 mb-3">
        {platformTips[preset] ?? "Les metadonnees SEO sont integrees dans le fichier image (EXIF). Vous pouvez aussi les copier ci-dessous."}
      </p>

      <div className="bg-[var(--surface-2)] rounded-xl p-3 space-y-2.5">
        {photo.seoFileName && (
          <div className="flex items-start gap-2">
            <FileText className="w-3.5 h-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Nom de fichier SEO</span>
              <div className="flex items-center gap-1">
                <code className="text-xs text-emerald-400 font-mono truncate">{photo.seoFileName}</code>
                <CopyBtn text={photo.seoFileName} />
              </div>
            </div>
          </div>
        )}
        {photo.seoAltText && (
          <div className="flex items-start gap-2">
            <FileText className="w-3.5 h-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Alt text (referencement images)</span>
              <p className="text-xs text-zinc-300">{photo.seoAltText}</p>
              <CopyBtn text={photo.seoAltText} />
            </div>
          </div>
        )}
        {photo.seoDescription && (
          <div className="flex items-start gap-2">
            <Hash className="w-3.5 h-3.5 text-zinc-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Description / legende</span>
              <p className="text-xs text-zinc-300">{photo.seoDescription}</p>
              <CopyBtn text={photo.seoDescription} />
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-zinc-600 mt-2 flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 text-emerald-500/50" />
        Metadonnees EXIF integrees dans le fichier — actives automatiquement a l'import
      </p>
    </div>
  );
}

// RetoucheChat
function RetoucheChat({ photo, preset }: { photo: Photo; preset: string }) {
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
          analysis: "Suggestions adaptees a votre secteur",
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
        analysis: "Suggestions adaptees a votre secteur",
        suggestions: presetSuggestions.map((s) => s.label),
        presetSuggestions,
      });
    }
  }

  async function handleRetouche(instructionText: string) {
    if (!instructionText.trim() || instructionText.trim().length < 3) {
      setError("Decrivez la retouche souhaitee (minimum 3 caracteres)");
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
          analysis: "Retouche echouee. Reessayez avec une autre instruction.",
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
      setError("Erreur reseau. Reessayez.");
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
      const currentState = state as Extract<RetoucheState, { step: "validating" }>;
      setState({
        step: "validated",
        resultUrl: data.resultUrl ?? currentState.resultUrl,
        inpaintingJobId,
      });
      setInstruction("");
    } else {
      const presetSuggestions = DEFAULT_SUGGESTIONS[preset] ?? [];
      setState({
        step: "ready",
        analysis: "Resultat rejete. Decrivez une autre retouche.",
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
      analysis: "Photo validee. Souhaitez-vous affiner davantage ?",
      suggestions: ["Ameliorer encore l'eclairage", "Ajouter plus de details", "Retouche complementaire"],
      presetSuggestions,
    });
    setInstruction("");
  }

  if (photo.status !== "COMPLETED") return null;

  return (
    <div className="mt-4 border-t border-white/5 pt-4">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <Pencil className="w-4 h-4 text-violet-400" /> Retouche IA
      </h3>

      {/* ANALYZING */}
      {state.step === "analyzing" && (
        <div className="bg-blue-500/10 rounded-xl p-4 flex items-center gap-3">
          <Search className="w-5 h-5 text-blue-400 animate-pulse" />
          <p className="text-sm text-blue-400">Analyse de la photo en cours... (gratuit)</p>
        </div>
      )}

      {/* READY */}
      {state.step === "ready" && (
        <div className="space-y-3">
          <div className="bg-[var(--surface-2)] rounded-xl p-3">
            <p className="text-xs text-[var(--muted)] font-medium mb-1 flex items-center gap-1">
              <Search className="w-3 h-3" /> Analyse
            </p>
            <p className="text-sm text-zinc-300">{state.analysis}</p>
          </div>

          {state.presetSuggestions.length > 0 && (
            <div>
              <p className="text-xs text-[var(--muted)] font-medium mb-2 flex items-center gap-1">
                <Lightbulb className="w-3 h-3" /> Suggestions rapides
              </p>
              <div className="flex flex-wrap gap-2">
                {state.presetSuggestions.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => handleSuggestionClick(s)}
                    className="flex items-center gap-1 text-xs bg-[var(--surface)] border border-white/8 hover:border-violet-400 hover:bg-violet-500/10 hover:text-violet-400 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-[var(--muted)] font-medium mb-1 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Ou decrivez votre retouche
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
                className="flex-1 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none bg-transparent text-white"
              />
              <button
                onClick={() => handleRetouche(instruction)}
                disabled={!instruction.trim()}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 transition-all self-end"
              >
                <Send className="w-4 h-4 sm:hidden" />
                <span className="hidden sm:inline">{INPAINTING_CREDITS_COST} credit</span>
              </button>
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">
              Le credit est debite uniquement si vous validez le resultat.
            </p>
          </div>
        </div>
      )}

      {/* RETOUCHING */}
      {state.step === "retouching" && (
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
          <div>
            <p className="text-sm font-semibold text-violet-300">Retouche IA en cours...</p>
            <p className="text-xs text-violet-400/70 mt-0.5">Gemini analyse et retouche votre photo (~20-40s)</p>
          </div>
        </div>
      )}

      {/* VALIDATING */}
      {state.step === "validating" && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">
            Resultat pret — <strong>aucun credit debite pour l'instant.</strong>
          </p>

          <div className="rounded-xl overflow-hidden border border-white/8">
            <div className="grid grid-cols-2 gap-0">
              <div className="relative">
                <p className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full z-10">Avant</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.originalUrl} alt="Avant" className="w-full aspect-video object-cover" />
              </div>
              <div className="relative">
                <p className="absolute top-2 left-2 bg-violet-600/80 text-white text-xs px-2 py-0.5 rounded-full z-10">Apres</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.resultUrl} alt="Apres retouche" className="w-full aspect-video object-cover" />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleValidate(state.inpaintingJobId, "approve")}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors text-sm"
            >
              <CheckCircle2 className="w-4 h-4" /> Valider — {INPAINTING_CREDITS_COST} credit
            </button>
            <button
              onClick={() => handleValidate(state.inpaintingJobId, "reject")}
              className="flex-1 flex items-center justify-center gap-2 bg-white/5 text-zinc-300 py-3 rounded-xl font-semibold hover:bg-white/8 transition-colors text-sm border border-white/8"
            >
              <XCircle className="w-4 h-4" /> Rejeter — gratuit
            </button>
          </div>
        </div>
      )}

      {/* VALIDATED */}
      {state.step === "validated" && (
        <div className="space-y-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-400">Retouche validee — 1 credit debite</p>
            </div>
            <a
              href={state.resultUrl}
              download="pictaura-retouche.jpg"
              className="flex items-center gap-1 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Download className="w-3 h-3" /> Telecharger
            </a>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.resultUrl} alt="Resultat retouche" className="w-full rounded-xl border border-white/8" />

          <button
            onClick={handleAffinement}
            className="w-full flex items-center justify-center gap-2 text-sm text-violet-400 font-medium py-2 border border-violet-500/20 rounded-xl hover:bg-violet-500/10 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Affiner encore (nouvelle retouche)
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl px-3 py-2">
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
      setFetchError("Impossible de charger les resultats. Verifiez votre connexion.");
    }
  }, [jobId]);

  const [pollTimeout, setPollTimeout] = useState(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    const maxPollTime = 10 * 60 * 1000; // 10 minutes max
    const startTime = Date.now();

    async function poll() {
      if (Date.now() - startTime > maxPollTime) {
        clearInterval(intervalId);
        setPollTimeout(true);
        return;
      }
      const data = await fetchJob();
      if (data?.status === "COMPLETED" || data?.status === "FAILED") {
        clearInterval(intervalId);
      }
    }

    poll();
    intervalId = setInterval(poll, 3000);
    return () => clearInterval(intervalId);
  }, [fetchJob]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/download`);
      if (!res.ok) { setActionError("Erreur lors du téléchargement"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pictaura_${job?.preset?.toLowerCase()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
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
              <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
              <p className="text-red-400 font-medium mb-2">{fetchError}</p>
              <Link href="/dashboard" className="text-violet-400 hover:underline text-sm">
                Retour au dashboard
              </Link>
            </>
          ) : (
            <>
              <Loader2 className="w-10 h-10 text-violet-400 animate-spin mx-auto mb-4" />
              <p className="text-zinc-400">Chargement...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const isProcessing = job.status === "PENDING" || job.status === "PROCESSING";
  const completedPhotos = job.photos.filter((p) => p.status === "COMPLETED");
  const currentPhoto = job.photos[activePhoto];
  const otherPresets = PRESETS.filter((p) => p !== job.preset);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {PRESET_LABELS[job.preset as keyof typeof PRESET_LABELS] ?? job.preset}
          </h1>
          <p className="text-zinc-400 mt-1">
            {completedPhotos.length}/{job.photos.length} photos traitees
          </p>
        </div>
        {completedPhotos.length > 0 && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:from-violet-700 hover:to-blue-700 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading ? "Preparation..." : "Telecharger le ZIP"}
          </button>
        )}
      </div>

      {/* Action error */}
      {actionError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError("")} className="text-red-400/60 hover:text-red-400 ml-4">✕</button>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            <div>
              <p className="font-semibold text-blue-300">Traitement IA en cours...</p>
              <p className="text-xs text-blue-400/70 mt-0.5">
                {completedPhotos.length > 0
                  ? `~${Math.round((job.photos.length - completedPhotos.length) * 35)}s restantes`
                  : `~${Math.round(job.photos.length * 35)}s estimees`}
              </p>
            </div>
          </div>
          <div className="w-full bg-blue-500/20 rounded-full h-2 mb-3">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-700"
              style={{ width: `${Math.max(5, (completedPhotos.length / Math.max(job.photos.length, 1)) * 100)}%` }}
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
      )}

      {/* Timeout warning */}
      {pollTimeout && isProcessing && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-amber-400" />
            <div className="flex-1">
              <p className="font-semibold text-amber-300">Le traitement prend plus de temps que prevu</p>
              <p className="text-xs text-amber-400/70 mt-1">
                Rechargez la page dans quelques minutes. Si le probleme persiste, contactez le support.
              </p>
            </div>
            <button
              onClick={() => { setPollTimeout(false); window.location.reload(); }}
              className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors text-sm whitespace-nowrap"
            >
              <RefreshCw className="w-4 h-4" /> Recharger
            </button>
          </div>
        </div>
      )}

      {/* Re-process with another preset */}
      {job.status === "COMPLETED" && (
        <div className="bg-[var(--surface-2)] border border-white/8 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-violet-400" /> Essayer un autre preset (1 credit/photo)
          </p>
          <div className="flex gap-2 flex-wrap">
            {otherPresets.map((p) => (
              <button
                key={p}
                onClick={() => handleReprocess(p)}
                disabled={reprocessing}
                className="px-4 py-1.5 text-sm border border-white/10 rounded-lg hover:border-violet-400 hover:text-violet-400 text-zinc-400 transition-colors disabled:opacity-50"
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
                activePhoto === index ? "border-violet-500" : "border-white/8"
              }`}
            >
              {photo.originalUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.originalUrl} alt={photo.fileName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                  {photo.status === "COMPLETED" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-zinc-500" />}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Slider + SEO + Retouche */}
      {currentPhoto && (
        <div className="bg-[var(--surface)] rounded-2xl border border-white/8 p-6 mb-6">
          <h2 className="font-semibold text-white mb-4 truncate">{currentPhoto.fileName}</h2>

          {currentPhoto.status === "COMPLETED" && currentPhoto.originalUrl && currentPhoto.processedUrl ? (
            <>
              <BeforeAfterSlider
                beforeUrl={currentPhoto.originalUrl}
                afterUrl={currentPhoto.processedUrl}
                alt={currentPhoto.fileName}
              />
              <div className="flex justify-between text-xs text-[var(--muted)] mt-2">
                {currentPhoto.fileSizeOriginal && (
                  <span>Original : {(currentPhoto.fileSizeOriginal / 1024).toFixed(0)} Ko</span>
                )}
                {currentPhoto.fileSizeProcessed && (
                  <span>Traite : {(currentPhoto.fileSizeProcessed / 1024).toFixed(0)} Ko</span>
                )}
              </div>
            </>
          ) : currentPhoto.status === "FAILED" ? (
            <div className="bg-red-500/10 rounded-xl p-6 text-center">
              <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-red-400 font-medium">Echec du traitement — credit rembourse</p>
            </div>
          ) : (
            <div className="bg-[var(--surface-2)] rounded-xl p-12 text-center">
              <Loader2 className="w-10 h-10 text-violet-400 animate-spin mx-auto mb-3" />
              <p className="text-zinc-400">Traitement en cours...</p>
            </div>
          )}

          {/* Watermark notice */}
          {currentPhoto.status === "COMPLETED" && job.isWatermarked === true && (
            <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-amber-400 text-base leading-none">&#128274;</span>
                <p className="text-sm text-amber-300 leading-snug">
                  Vos photos contiennent un watermark Pictaura
                </p>
              </div>
              <Link
                href="/billing"
                className="flex-shrink-0 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors whitespace-nowrap"
              >
                Passer au Pro →
              </Link>
            </div>
          )}

          {/* Score + SEO */}
          {currentPhoto.status === "COMPLETED" && (
            <div className="mt-6 space-y-3">
              {currentPhoto.photoScore !== null && (
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-violet-300">
                      Score photo : {currentPhoto.photoScore}/10
                    </span>
                    <div className="flex-1 h-2 bg-violet-500/15 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full"
                        style={{ width: `${(currentPhoto.photoScore / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                  {currentPhoto.photoScoreReport && (
                    <p className="text-xs text-violet-400/70">{currentPhoto.photoScoreReport}</p>
                  )}
                </div>
              )}

            </div>
          )}

          {/* SEO optimization panel */}
          <SeoPanel photo={currentPhoto} preset={job.preset} />

          {/* Retouche IA inline */}
          <RetoucheChat photo={currentPhoto} preset={job.preset} />
        </div>
      )}

      <div className="text-center">
        <Link href="/dashboard" className="text-violet-400 font-medium hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Retour au dashboard
        </Link>
      </div>
    </div>
  );
}
