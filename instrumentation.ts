export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");

    // Pre-warm Gemini connection on cold start so the first user-facing retouch
    // doesn't pay the HTTP/2 TLS handshake + SDK init cost (~200-500ms saved).
    // Fire-and-forget: silently skip if env vars aren't ready or ping fails.
    import("./src/lib/gemini")
      .then(({ pingGemini }) => pingGemini())
      .then(({ latency_ms }) => console.log(`Gemini pre-warmed in ${latency_ms}ms`))
      .catch((err) => console.warn("Gemini pre-warm skipped:", err instanceof Error ? err.message : err));

    // Recover jobs orphaned by a previous process that died mid-processing
    // (status déjà PROCESSING, worker mort en plein vol) : le claim atomique
    // de processJob() empêche toute reprise automatique de ce cas précis.
    // Fire-and-forget, inactivity-based (won't touch jobs a still-draining
    // old container is finishing).
    import("./src/services/processing/job-recovery")
      .then(({ recoverOrphanedJobsOnBoot }) => recoverOrphanedJobsOnBoot())
      .catch((err) => console.warn("Boot job recovery skipped:", err instanceof Error ? err.message : err));

    // Worker pg-boss : reprend la file persistante de lancements de pipeline.
    // Couvre le cas où le lancement lui-même (pas le traitement) a été perdu
    // par un crash/redeploy avant même de démarrer — le message survit en DB
    // et est repris ici au boot du process suivant.
    import("./src/services/processing/queue")
      .then(({ startJobWorker }) => startJobWorker())
      .catch((err) => console.warn("Job queue worker skipped:", err instanceof Error ? err.message : err));

    // Canary scheduler interne : sonde le provider image toutes les
    // CANARY_INTERVAL_MIN (défaut 45) si CANARY_ENABLED=true. Zéro cron externe.
    import("./src/services/monitoring/canary")
      .then(({ startCanaryScheduler }) => startCanaryScheduler())
      .catch((err) => console.warn("Canary scheduler skipped:", err instanceof Error ? err.message : err));
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
