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

    // Recover jobs orphaned by the previous process (crash/redeploy) : the
    // pipeline runs in-process, so any job it carried will never resume.
    // Fire-and-forget, inactivity-based (won't touch jobs a still-draining
    // old container is finishing).
    import("./src/services/processing/job-recovery")
      .then(({ recoverOrphanedJobsOnBoot }) => recoverOrphanedJobsOnBoot())
      .catch((err) => console.warn("Boot job recovery skipped:", err instanceof Error ? err.message : err));
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
