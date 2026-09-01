"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pictaura_install_dismissed";

/**
 * Invite à installer Pictaura sur l'écran d'accueil (PWA). Android/Chrome :
 * prompt natif via `beforeinstallprompt`. iOS Safari : pas d'API de prompt,
 * juste une astuce statique ("Partager → Sur l'écran d'accueil").
 * Adapté du composant équivalent de maison-kassa (même patron, sans service
 * worker — l'installabilité suffit à l'objectif "app mobile").
 */
export function InstallAppPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* localStorage bloqué — pas d'invite plutôt qu'une erreur */
      return;
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    if (isIOS) {
      setIosHint(true);
      setShow(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch { /* ignore */ }
    setShow(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    dismiss();
  }

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm">
      <Download className="mt-0.5 w-5 h-5 flex-shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">Installer Pictaura sur votre téléphone</p>
        {iosHint ? (
          <p className="mt-0.5 text-xs text-ink-muted">
            Appuyez sur <Share className="inline w-3.5 h-3.5" /> Partager, puis « Sur l&apos;écran d&apos;accueil ».
          </p>
        ) : (
          <button
            onClick={install}
            className="mt-2 inline-flex items-center gap-1.5 bg-accent text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-accent-hover transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Installer
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="flex-shrink-0 rounded-lg p-1 text-ink-muted hover:bg-ink/5 hover:text-ink transition-colors"
        aria-label="Fermer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
