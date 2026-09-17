/**
 * Plafond GLOBAL des requêtes simultanées vers fal.run.
 *
 * fal limite la concurrence au niveau du COMPTE, tous endpoints confondus
 * (retouche, upscale ESRGAN, SEO any-llm) : de 2 requêtes pour un compte neuf
 * jusqu'à 40 selon les crédits achetés sur 4 semaines. Au-delà, une requête
 * synchrone en HTTP brut reçoit un 429 `concurrent_requests_limit` — que le
 * monitoring prenait pour un problème de quota/facturation.
 *
 * Sans ce plafond, la concurrence n'était bornée que PAR LOT (8 workers), et
 * chaque photo Starter émet jusqu'à 3 requêtes fal (retouche, upscale, SEO en
 * arrière-plan) : un seul client pouvait dépasser la limite, deux clients
 * simultanés la dépassaient à coup sûr.
 *
 * Priorités : les appels dont le client attend le résultat ("high" : retouche,
 * upscale, analyse) passent avant l'enrichissement SEO en arrière-plan
 * ("low"). Un appel "low" qui attend depuis plus de LOW_MAX_WAIT_MS est servi
 * comme un "high" : un trafic de retouche continu ne peut pas le bloquer
 * indéfiniment.
 *
 * Mono-instance, en mémoire (même hypothèse que le circuit breaker). L'état
 * vit sur globalThis : Next peut charger ce module dans plusieurs bundles
 * serveur (routes, instrumentation, worker pg-boss) qui doivent partager le
 * MÊME compteur.
 *
 * Config : FAL_MAX_CONCURRENCY (défaut 6 — valeur tenue sans erreur lors d'un
 * test en rafale réel le 2026-09-16). À aligner sur la limite affichée dans le
 * dashboard fal (Usage & Billing → Concurrency), en gardant 1-2 slots de marge.
 */

export type FalPriority = "high" | "low";

type Waiter = { priority: FalPriority; enqueuedAt: number; grant: () => void };

type GateState = { inFlight: number; queue: Waiter[] };

const LOW_MAX_WAIT_MS = 20_000;

declare global {
  // eslint-disable-next-line no-var
  var __pictauraFalGate: GateState | undefined;
}

function state(): GateState {
  return (globalThis.__pictauraFalGate ??= { inFlight: 0, queue: [] });
}

export function falMaxConcurrency(): number {
  const n = Number(process.env.FAL_MAX_CONCURRENCY);
  return Number.isInteger(n) && n > 0 ? n : 6;
}

/** Retire de la file le prochain appel à servir, ou undefined si la file est vide. */
function takeNext(s: GateState): Waiter | undefined {
  if (s.queue.length === 0) return undefined;
  const now = Date.now();
  // Ordre FIFO dans chaque priorité ; un "low" trop ancien passe devant.
  let idx = s.queue.findIndex((w) => w.priority === "low" && now - w.enqueuedAt > LOW_MAX_WAIT_MS);
  if (idx === -1) idx = s.queue.findIndex((w) => w.priority === "high");
  if (idx === -1) idx = 0;
  return s.queue.splice(idx, 1)[0];
}

function release(): void {
  const s = state();
  const next = takeNext(s);
  if (next) {
    // Le slot passe directement au suivant : inFlight ne bouge pas.
    next.grant();
  } else {
    s.inFlight = Math.max(0, s.inFlight - 1);
  }
}

/**
 * Exécute `fn` en occupant un slot de concurrence fal.
 *
 * Créer le signal de timeout DANS `fn` : un timeout créé avant l'appel
 * décompterait aussi le temps passé à attendre un slot.
 */
export async function withFalSlot<T>(fn: () => Promise<T>, priority: FalPriority = "high"): Promise<T> {
  const s = state();
  if (s.inFlight < falMaxConcurrency() && s.queue.length === 0) {
    s.inFlight++;
  } else {
    await new Promise<void>((resolve) => {
      s.queue.push({ priority, enqueuedAt: Date.now(), grant: resolve });
    });
  }
  try {
    return await fn();
  } finally {
    release();
  }
}

/** État instantané pour /api/health/image. */
export function getFalGateSnapshot(): { limit: number; inFlight: number; queued: number } {
  const s = state();
  return { limit: falMaxConcurrency(), inFlight: s.inFlight, queued: s.queue.length };
}
